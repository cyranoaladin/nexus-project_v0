#!/usr/bin/env node
/**
 * Governance guard: MERGED_BRANCH_IS_IMMUTABLE / POST_MERGE_CHANGES_REQUIRE_NEW_PR.
 *
 * A merged PR's own remote branch is never deleted in this repo
 * (deleteBranchOnMerge=false), so nothing stops someone from pushing more
 * commits to it after merge. Those commits are NOT on main and NEVER went
 * through review on that PR — GitHub's PR "head" field silently tracks the
 * branch's CURRENT tip, not the SHA that was actually merged, so a stale
 * "PR #N delivered X" belief can persist even though X never reached main
 * (proven incident: PR #272, merged at bf4dfd0, later advanced to 112ca1e
 * with a real feature commit that only reached main via a brand-new PR #275).
 *
 * A naive "current head != merged head AND not an ancestor of main" check is
 * too coarse: a branch can also be force-pushed BACKWARDS (rewound), or
 * reused later for something unrelated and diverged from its merged state —
 * neither of those is "unreviewed product work that almost reached main"
 * (proven false positive: PR #15's branch is DIVERGED from what was merged,
 * ahead_by=566/behind_by=459 per GitHub's own compare view — a branch-hygiene
 * fact, not a silently-dropped delta). So every merged-then-drifted branch is
 * classified into exactly one of:
 *
 *   UNCHANGED                        — current head == merged head
 *   FAST_FORWARD_ADVANCED_AFTER_MERGE — current head is a descendant of the
 *                                       merged head (the dangerous #272 shape)
 *   REWOUND_AFTER_MERGE              — current head is an ANCESTOR of the
 *                                       merged head (force-pushed backwards) —
 *                                       never a product-delta finding
 *   PATCH_EQUIVALENT                 — advanced or diverged, but every commit
 *                                       reachable only from current head has a
 *                                       patch-id match already reachable from
 *                                       the merged head (rebase/re-commit,
 *                                       same content)
 *   UNIQUE_PATCH_ALREADY_IN_MAIN     — advanced or diverged, with genuinely
 *                                       new patches vs. the merged head, but
 *                                       every one of those patches already has
 *                                       a patch-id match reachable from main
 *                                       (independently re-landed / squashed)
 *   UNIQUE_PATCH_REVIEWED_ELSEWHERE  — genuinely new patches, not (yet) on
 *                                       main, but another PR (any state) on
 *                                       the same branch name already surfaced
 *                                       them for review
 *   UNIQUE_PATCH_UNREVIEWED          — genuinely new patches, not on main, no
 *                                       other PR ever reviewed them — the
 *                                       ONLY classification that counts
 *                                       toward POST_MERGE_UNREVIEWED_REQUIRED_DELTA
 *   DIVERGED_OR_REUSED               — (falls through to one of the two
 *                                       patch-id outcomes above; kept as an
 *                                       internal label only if patch-id
 *                                       classification could not run)
 *
 * "Genuinely new patches vs. the merged head" and "already on main" are both
 * decided via `git cherry`'s own patch-id comparison (not raw SHA/ancestry),
 * so a rebase, cherry-pick, or squash-merge that changed commit hashes but
 * not content is correctly recognized as equivalent.
 *
 * Requires (CLI mode only): `gh` CLI authenticated, run from a full clone
 * (not shallow).
 */
import { execFileSync as defaultExecFileSync } from 'node:child_process';

// gitOps is injectable so classifyPostMergeDrift is unit-testable offline —
// see __tests__/governance/check-post-merge-branch-drift.test.js — following
// the same pattern as scripts/github/lib/gh.mjs's createGhClient().
export function createGitOps(execFileSyncImpl = defaultExecFileSync) {
  function sh(args) {
    return execFileSyncImpl('git', args, { encoding: 'utf8' }).trim();
  }
  return {
    mergeCommitParents(oid) {
      return sh(['show', '-s', '--format=%P', oid]).split(' ').filter(Boolean);
    },
    currentRemoteHead(headRefName) {
      let out;
      try {
        out = sh(['ls-remote', 'origin', `refs/heads/${headRefName}`]);
      } catch {
        return '';
      }
      return out.split('\t')[0] ?? '';
    },
    isAncestor(ancestorSha, descendantSha) {
      try {
        execFileSyncImpl('git', ['merge-base', '--is-ancestor', ancestorSha, descendantSha], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    },
    // Commits reachable from `tip` but not `base`, marked '+' by `git cherry`
    // when no patch-id-equivalent commit exists on the `base`-only side —
    // i.e. genuinely new content, not a rebase/cherry-pick of something the
    // base already has. Returns null (not an empty array) when the
    // comparison could not be computed at all (e.g. a shallow clone missing
    // objects), so callers can tell "computed, found nothing" apart from
    // "could not compute".
    cherryPlus(base, tip) {
      let out;
      try {
        out = sh(['cherry', base, tip]);
      } catch {
        return null;
      }
      if (!out) return [];
      return out
        .split('\n')
        .filter(line => line.startsWith('+'))
        .map(line => line.trim().split(/\s+/)[1]);
    },
  };
}

/**
 * Pure classification: given the merged PRs, every PR (any state, for
 * superseding-branch detection), and injectable git operations, returns the
 * list of merged PRs whose branch drifted post-merge, each tagged with its
 * classification (see the module doc comment) and whether it counts as a
 * required, unreviewed delta.
 */
export function classifyPostMergeDrift(mergedPrs, allPrs, gitOps) {
  const prsByBranch = new Map();
  for (const pr of allPrs) {
    const list = prsByBranch.get(pr.headRefName) ?? [];
    list.push(pr);
    prsByBranch.set(pr.headRefName, list);
  }

  const findings = [];

  for (const pr of mergedPrs) {
    if (!pr.mergeCommit) continue; // squash/rebase merge — this branch's second-parent check does not apply

    let parents;
    try {
      parents = gitOps.mergeCommitParents(pr.mergeCommit.oid);
    } catch {
      continue; // merge commit not reachable in this clone
    }
    if (parents.length !== 2) continue; // not a standard two-parent merge
    const prMergedHead = parents[1];

    const currentRemoteHead = gitOps.currentRemoteHead(pr.headRefName);
    if (!currentRemoteHead) continue; // branch deleted post-merge — nothing to drift
    if (currentRemoteHead === prMergedHead) continue; // UNCHANGED — untouched since merge, compliant

    // A branch name can be reused: someone may have continued work on it after
    // merge and opened a SEPARATE, later PR (open or closed) on that same
    // headRefName. An open superseding PR is a still-live, still-open review
    // track; a closed-unmerged one is an abandoned but at-least-surfaced
    // attempt; NO superseding PR at all is the dangerous case (#272): drift
    // nobody ever opened a review for.
    const supersedingPr =
      prsByBranch
        .get(pr.headRefName)
        ?.filter(candidate => candidate.number !== pr.number)
        .sort((a, b) => b.number - a.number)[0] ?? null;

    const advanced = gitOps.isAncestor(prMergedHead, currentRemoteHead);
    const rewound = !advanced && gitOps.isAncestor(currentRemoteHead, prMergedHead);

    let classification;
    let requiredDelta = false;

    if (rewound) {
      classification = 'REWOUND_AFTER_MERGE';
    } else {
      // FAST_FORWARD_ADVANCED_AFTER_MERGE or DIVERGED_OR_REUSED so far —
      // both need the same patch-id-based refinement below.
      const vsMergedPlus = gitOps.cherryPlus(prMergedHead, currentRemoteHead);

      if (vsMergedPlus === null) {
        // Could not compute (e.g. objects missing in a shallow clone) — fall
        // back to the coarse shape label rather than guessing a patch verdict.
        classification = advanced ? 'FAST_FORWARD_ADVANCED_AFTER_MERGE' : 'DIVERGED_OR_REUSED';
      } else if (vsMergedPlus.length === 0) {
        classification = 'PATCH_EQUIVALENT';
      } else {
        const vsMainPlus = new Set(gitOps.cherryPlus('origin/main', currentRemoteHead) ?? []);
        const stillMissingFromMain = vsMergedPlus.some(sha => vsMainPlus.has(sha));
        if (!stillMissingFromMain) {
          classification = 'UNIQUE_PATCH_ALREADY_IN_MAIN';
        } else if (supersedingPr) {
          classification = 'UNIQUE_PATCH_REVIEWED_ELSEWHERE';
        } else {
          classification = 'UNIQUE_PATCH_UNREVIEWED';
          requiredDelta = true;
        }
      }
    }

    findings.push({
      number: pr.number,
      headRefName: pr.headRefName,
      prMergedHead,
      currentRemoteHead,
      classification,
      requiredDelta,
      supersedingPr,
    });
  }

  return findings;
}

function report(findings) {
  const unreviewedRequiredDeltas = findings.filter(f => f.requiredDelta);

  if (findings.length === 0) {
    console.log('POST_MERGE_UNREVIEWED_REQUIRED_DELTAS=0');
    console.log('No merged PR branch has drifted from its merged head.');
    return 0;
  }

  console.log('Merged PR branches that differ from their merged head today:');
  for (const f of findings) {
    const supersedingNote = f.supersedingPr
      ? `SUPERSEDING_PR=#${f.supersedingPr.number}(${f.supersedingPr.state})`
      : 'SUPERSEDING_PR=NONE';
    console.log(
      `  PR #${f.number} (${f.headRefName}): PR_MERGED_HEAD=${f.prMergedHead.slice(0, 12)} ` +
        `CURRENT_REMOTE_BRANCH_HEAD=${f.currentRemoteHead.slice(0, 12)} ` +
        `CLASSIFICATION=${f.classification} ${supersedingNote}`,
    );
  }

  console.log(`POST_MERGE_DRIFTED_BRANCHES_TOTAL=${findings.length}`);
  console.log(`POST_MERGE_UNREVIEWED_REQUIRED_DELTAS=${unreviewedRequiredDeltas.length}`);
  if (unreviewedRequiredDeltas.length > 0) {
    console.error(
      '\nEach PR above classified UNIQUE_PATCH_UNREVIEWED has commits that were never reviewed ' +
        'under ANY PR and are not otherwise present on main (by content, not just by SHA). Per ' +
        'governance rule MERGED_BRANCH_IS_IMMUTABLE=true / POST_MERGE_CHANGES_REQUIRE_NEW_PR=true: ' +
        'open a NEW PR from current main cherry-picking only the unique delta — never assume the ' +
        'old (merged) PR delivered it, and never reuse that PR as review authority for the new ' +
        'commits.\nEvery other classification above is a branch-hygiene finding (rewind, reuse, ' +
        'already-landed-elsewhere, or already-reviewed-elsewhere) and does not block on its own, ' +
        'but still warrants an explicit decision: land, rebase, or delete the branch.',
    );
    return 1;
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sh = (cmd, args) => defaultExecFileSync(cmd, args, { encoding: 'utf8' }).trim();
  const mergedPrs = JSON.parse(
    sh('gh', ['pr', 'list', '--state', 'merged', '--limit', '500', '--json', 'number,headRefName,mergeCommit']),
  );
  const allPrs = JSON.parse(
    sh('gh', ['pr', 'list', '--state', 'all', '--limit', '1000', '--json', 'number,headRefName,state']),
  );
  const findings = classifyPostMergeDrift(mergedPrs, allPrs, createGitOps());
  process.exitCode = report(findings);
}
