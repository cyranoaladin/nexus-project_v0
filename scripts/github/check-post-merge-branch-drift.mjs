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
 * For every merged PR (standard merge-commit strategy — the merge commit's
 * second parent is the exact SHA that was actually merged), this compares:
 *   - prMergedHead: the merge commit's second parent
 *   - currentRemoteHead: `git ls-remote` of the PR's head branch today
 *   - mainContainsDelta: whether currentRemoteHead is an ancestor of main
 *     (i.e. the delta, if any, was independently re-landed)
 *   - supersedingPr: any other PR (open or closed, any state) sharing the
 *     same head branch name — a branch can be reused after merge for a
 *     later, separately-reviewed attempt, which is a lower-urgency situation
 *     than drift nobody ever opened a review for.
 *
 * Exits non-zero when POST_MERGE_UNREVIEWED_REQUIRED_DELTAS > 0: a merged PR
 * whose branch was pushed to after merge, with content not otherwise on main
 * AND no other PR (of any state) ever surfaced that work for review.
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
    isAncestorOfMain(sha) {
      try {
        execFileSyncImpl('git', ['merge-base', '--is-ancestor', sha, 'origin/main']);
        return true;
      } catch {
        return false;
      }
    },
  };
}

/**
 * Pure classification: given the merged PRs, every PR (any state, for
 * superseding-branch detection), and injectable git operations, returns the
 * list of merged PRs whose branch drifted post-merge.
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
    if (currentRemoteHead === prMergedHead) continue; // untouched since merge — compliant

    const mainContainsDelta = gitOps.isAncestorOfMain(currentRemoteHead);

    // A branch name can be reused: someone may have continued work on it after
    // merge and opened a SEPARATE, later PR (open or closed) on that same
    // headRefName. That changes the risk category even though the raw SHA
    // comparison above still shows drift: an open superseding PR is a still-live,
    // still-open review track (arguably just needs a rebase-off-main note); a
    // closed-unmerged one is an abandoned but at-least-surfaced attempt; NO
    // superseding PR at all is the dangerous case (#272): drift nobody ever
    // opened a review for.
    const supersedingPr =
      prsByBranch
        .get(pr.headRefName)
        ?.filter(candidate => candidate.number !== pr.number)
        .sort((a, b) => b.number - a.number)[0] ?? null;

    findings.push({
      number: pr.number,
      headRefName: pr.headRefName,
      prMergedHead,
      currentRemoteHead,
      mainContainsDelta,
      supersedingPr,
    });
  }

  return findings;
}

function report(findings) {
  const requiredDeltas = findings.filter(f => !f.mainContainsDelta);
  const silentRequiredDeltas = requiredDeltas.filter(f => !f.supersedingPr);

  if (findings.length === 0) {
    console.log('POST_MERGE_UNREVIEWED_REQUIRED_DELTAS=0');
    console.log('No merged PR branch has drifted from its merged head.');
    return 0;
  }

  console.log('Merged PR branches that were pushed to AFTER merge:');
  for (const f of findings) {
    const supersedingNote = f.supersedingPr
      ? `SUPERSEDING_PR=#${f.supersedingPr.number}(${f.supersedingPr.state})`
      : 'SUPERSEDING_PR=NONE';
    console.log(
      `  PR #${f.number} (${f.headRefName}): PR_MERGED_HEAD=${f.prMergedHead.slice(0, 12)} ` +
        `CURRENT_REMOTE_BRANCH_HEAD=${f.currentRemoteHead.slice(0, 12)} ` +
        `MAIN_CONTAINS_BRANCH_DELTA=${f.mainContainsDelta ? 'YES' : 'NO'} ${supersedingNote}`,
    );
  }

  console.log(`POST_MERGE_REQUIRED_DELTAS_TOTAL=${requiredDeltas.length}`);
  console.log(`POST_MERGE_UNREVIEWED_REQUIRED_DELTAS=${silentRequiredDeltas.length}`);
  if (silentRequiredDeltas.length > 0) {
    console.error(
      '\nEach PR above with MAIN_CONTAINS_BRANCH_DELTA=NO and SUPERSEDING_PR=NONE has commits ' +
        'that were never reviewed under ANY PR and never reached main. Per governance rule ' +
        'MERGED_BRANCH_IS_IMMUTABLE=true / POST_MERGE_CHANGES_REQUIRE_NEW_PR=true: open a NEW PR ' +
        'from current main cherry-picking only the unique delta — never assume the old (merged) PR ' +
        'delivered it, and never reuse that PR as review authority for the new commits.\n' +
        'Entries with a SUPERSEDING_PR are lower-urgency (already surfaced under a real PR, even ' +
        'if closed/abandoned) but still warrant an explicit decision: land, rebase, or delete.',
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
