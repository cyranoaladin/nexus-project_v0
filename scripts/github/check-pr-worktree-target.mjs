#!/usr/bin/env node
/**
 * PR/worktree target-integrity preflight.
 *
 * Incident: PR #268's worktree had real, correct commits, but its local
 * branch's upstream pointed at a same-repo branch
 * (fix/pr268-notification-gate-and-durability) that was NOT the branch the
 * open PR actually tracks (feat/aria-p7c-bilan-published-notification-...).
 * Every push "succeeded" — git reported no error — but silently landed on a
 * branch with no PR attached, so CI never ran and the reviewed PR object
 * never moved. `git status`'s clean/ahead output gives no signal that the
 * upstream itself is the wrong target.
 *
 * Run BEFORE pushing to an open PR's branch (`--pr <number>`) to fail
 * closed on a mismatched target, and AFTER pushing (`--after-push`) to
 * confirm the push actually reached the PR GitHub reviews.
 *
 * Usage:
 *   node scripts/github/check-pr-worktree-target.mjs --pr 268
 *   node scripts/github/check-pr-worktree-target.mjs --pr 268 --after-push
 *
 * Exit 0: LOCAL_BRANCH == PR_HEAD_REF, UPSTREAM == origin/PR_HEAD_REF, no
 * hidden push-target override, and (with --after-push) the remote branch
 * and the PR's own head both equal LOCAL_HEAD.
 * Exit 1: any mismatch — fails closed, prints exactly what disagrees.
 */
import { execFileSync as defaultExecFileSync } from 'node:child_process';

export function createRepoOps(execFileSyncImpl = defaultExecFileSync) {
  function git(args) {
    return execFileSyncImpl('git', args, { encoding: 'utf8' }).trim();
  }
  function gitOrNull(args) {
    try {
      return git(args);
    } catch {
      return null;
    }
  }
  return {
    currentBranch: () => git(['rev-parse', '--abbrev-ref', 'HEAD']),
    localHead: () => git(['rev-parse', 'HEAD']),
    configGet: key => gitOrNull(['config', '--get', key]),
    upstream: () => gitOrNull(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']),
    remoteHead: (remote, branch) => {
      const out = gitOrNull(['ls-remote', remote, `refs/heads/${branch}`]);
      return out ? out.split('\t')[0] : null;
    },
    prHead: prNumber => {
      const raw = execFileSyncImpl('gh', ['pr', 'view', String(prNumber), '--json', 'headRefName,headRefOid'], {
        encoding: 'utf8',
      });
      const parsed = JSON.parse(raw);
      return { headRefName: parsed.headRefName, headRefOid: parsed.headRefOid };
    },
  };
}

/**
 * Pure check: given the local repo state, the PR's real head, and repoOps
 * for the extra hidden-push-target inspection, returns { ok, findings }.
 * findings is a list of human-readable mismatch strings — empty when ok.
 */
export function checkPrWorktreeTarget({ localBranch, localHead, upstream, prHeadRef, prHeadOid }, opts = {}) {
  const findings = [];

  if (localBranch !== prHeadRef) {
    findings.push(
      `LOCAL_BRANCH ("${localBranch}") != PR_HEAD_REF ("${prHeadRef}") — this worktree is not even checked out to the PR's branch name.`,
    );
  }

  const expectedUpstream = `origin/${prHeadRef}`;
  if (upstream !== expectedUpstream) {
    findings.push(
      `UPSTREAM ("${upstream ?? 'NONE'}") != "${expectedUpstream}" — a push with no explicit refspec would NOT reach the PR's branch.`,
    );
  }

  if (opts.afterPush) {
    if (opts.remoteHead !== localHead) {
      findings.push(
        `POST-PUSH: git ls-remote origin refs/heads/${prHeadRef} ("${opts.remoteHead ?? 'MISSING'}") != LOCAL_HEAD ("${localHead}") — the push did not land where expected.`,
      );
    }
    if (prHeadOid !== localHead) {
      findings.push(
        `POST-PUSH: GitHub PR #${opts.prNumber} head OID ("${prHeadOid}") != LOCAL_HEAD ("${localHead}") — GitHub has not registered this push (could be propagation lag; re-check, or the push reached the wrong branch).`,
      );
    }
  }

  return { ok: findings.length === 0, findings };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const prIndex = args.indexOf('--pr');
  if (prIndex === -1 || !args[prIndex + 1]) {
    console.error('Usage: node scripts/github/check-pr-worktree-target.mjs --pr <number> [--after-push]');
    process.exit(64);
  }
  const prNumber = args[prIndex + 1];
  const afterPush = args.includes('--after-push');

  const ops = createRepoOps();
  const localBranch = ops.currentBranch();
  const localHead = ops.localHead();
  const upstream = ops.upstream();
  const { headRefName: prHeadRef, headRefOid: prHeadOid } = ops.prHead(prNumber);

  // No hidden push-target override: a branch-specific pushRemote, or a
  // repo-wide pushDefault, silently redirects `git push` even when the
  // upstream/remote-tracking branch itself looks correct.
  const pushRemoteOverride = ops.configGet(`branch.${localBranch}.pushRemote`);
  const pushDefaultOverride = ops.configGet('remote.pushDefault');
  const hiddenOverrides = [];
  if (pushRemoteOverride && pushRemoteOverride !== 'origin') {
    hiddenOverrides.push(`branch.${localBranch}.pushRemote="${pushRemoteOverride}" overrides the push target away from origin.`);
  }
  if (pushDefaultOverride && pushDefaultOverride !== 'origin') {
    hiddenOverrides.push(`remote.pushDefault="${pushDefaultOverride}" overrides the push target away from origin.`);
  }

  const result = checkPrWorktreeTarget(
    { localBranch, localHead, upstream, prHeadRef, prHeadOid },
    {
      afterPush,
      prNumber,
      remoteHead: afterPush ? ops.remoteHead('origin', prHeadRef) : undefined,
    },
  );

  const findings = [...result.findings, ...hiddenOverrides];

  console.log(`LOCAL_BRANCH=${localBranch}`);
  console.log(`LOCAL_HEAD=${localHead}`);
  console.log(`UPSTREAM=${upstream ?? 'NONE'}`);
  console.log(`PR_HEAD_REF=${prHeadRef}`);
  console.log(`PR_HEAD_OID=${prHeadOid}`);
  console.log(`OPEN_PR_WORKTREE_TARGET_MISMATCHES=${findings.length}`);
  for (const f of findings) console.error(`  MISMATCH: ${f}`);

  if (findings.length > 0) {
    console.error(
      `\nFAIL CLOSED. Do not push. Prefer an explicit target: git push origin HEAD:refs/heads/${prHeadRef}`,
    );
    process.exit(1);
  }
  console.log('OK — push target verified.');
}
