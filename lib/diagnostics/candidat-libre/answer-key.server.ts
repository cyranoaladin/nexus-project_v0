import 'server-only';

export type DiagnosticAnswerKey =
  | { kind: 'single'; correct: string }
  | { kind: 'multiple'; correct: string[]; partial?: boolean }
  | { kind: 'numeric'; value: number; tolerance: number }
  | { kind: 'scale'; min: number; max: number; direction: 1 | -1 }
  | { kind: 'ack'; expected: boolean }
  | { kind: 'manual' }
  | { kind: 'neutral' };

export const CANDIDATE_DIAGNOSTIC_ANSWER_KEYS: Record<string, DiagnosticAnswerKey> = {
  "integrity-01": {
    "kind": "ack",
    "expected": true
  },
  "integrity-02": {
    "kind": "ack",
    "expected": true
  },
  "integrity-03": {
    "kind": "ack",
    "expected": true
  },
  "integrity-04": {
    "kind": "neutral"
  },
  "integrity-05": {
    "kind": "neutral"
  },
  "integrity-06": {
    "kind": "neutral"
  },
  "integrity-07": {
    "kind": "ack",
    "expected": true
  },
  "integrity-08": {
    "kind": "ack",
    "expected": true
  },
  "profil-01": {
    "kind": "neutral"
  },
  "profil-02": {
    "kind": "neutral"
  },
  "profil-03": {
    "kind": "neutral"
  },
  "profil-04": {
    "kind": "neutral"
  },
  "profil-05": {
    "kind": "neutral"
  },
  "profil-06": {
    "kind": "neutral"
  },
  "profil-07": {
    "kind": "neutral"
  },
  "profil-08": {
    "kind": "neutral"
  },
  "profil-09": {
    "kind": "neutral"
  },
  "profil-10": {
    "kind": "neutral"
  },
  "profil-11": {
    "kind": "neutral"
  },
  "profil-12": {
    "kind": "manual"
  },
  "profil-13": {
    "kind": "neutral"
  },
  "profil-14": {
    "kind": "neutral"
  },
  "profil-15": {
    "kind": "neutral"
  },
  "profil-16": {
    "kind": "neutral"
  },
  "profil-17": {
    "kind": "manual"
  },
  "profil-18": {
    "kind": "manual"
  },
  "profil-19": {
    "kind": "neutral"
  },
  "profil-20": {
    "kind": "manual"
  },
  "auto-01": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-02": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-03": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-04": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-05": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-06": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-07": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-08": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-09": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-10": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-11": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-12": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-13": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-14": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-15": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-16": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-17": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-18": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-19": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-20": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-21": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-22": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-23": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-24": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "auto-25": {
    "kind": "manual"
  },
  "auto-26": {
    "kind": "manual"
  },
  "auto-27": {
    "kind": "manual"
  },
  "auto-28": {
    "kind": "neutral"
  },
  "fr-info": {
    "kind": "neutral"
  },
  "fr-01": {
    "kind": "single",
    "correct": "c"
  },
  "fr-02": {
    "kind": "single",
    "correct": "b"
  },
  "fr-03": {
    "kind": "single",
    "correct": "b"
  },
  "fr-04": {
    "kind": "single",
    "correct": "b"
  },
  "fr-05": {
    "kind": "single",
    "correct": "b"
  },
  "fr-06": {
    "kind": "single",
    "correct": "b"
  },
  "fr-07": {
    "kind": "single",
    "correct": "b"
  },
  "fr-08": {
    "kind": "single",
    "correct": "b"
  },
  "fr-09": {
    "kind": "single",
    "correct": "b"
  },
  "fr-10": {
    "kind": "single",
    "correct": "b"
  },
  "fr-11": {
    "kind": "single",
    "correct": "a"
  },
  "fr-12": {
    "kind": "single",
    "correct": "a"
  },
  "fr-13": {
    "kind": "single",
    "correct": "b"
  },
  "fr-14": {
    "kind": "single",
    "correct": "c"
  },
  "fr-15": {
    "kind": "single",
    "correct": "b"
  },
  "fr-16": {
    "kind": "manual"
  },
  "fr-17": {
    "kind": "manual"
  },
  "fr-18": {
    "kind": "manual"
  },
  "fr-19": {
    "kind": "manual"
  },
  "fr-20": {
    "kind": "manual"
  },
  "fr-21": {
    "kind": "neutral"
  },
  "fr-22": {
    "kind": "neutral"
  },
  "fr-23": {
    "kind": "manual"
  },
  "fr-24": {
    "kind": "neutral"
  },
  "math-01": {
    "kind": "single",
    "correct": "a"
  },
  "math-02": {
    "kind": "single",
    "correct": "b"
  },
  "math-03": {
    "kind": "single",
    "correct": "b"
  },
  "math-04": {
    "kind": "single",
    "correct": "b"
  },
  "math-05": {
    "kind": "single",
    "correct": "c"
  },
  "math-06": {
    "kind": "single",
    "correct": "b"
  },
  "math-07": {
    "kind": "single",
    "correct": "a"
  },
  "math-08": {
    "kind": "single",
    "correct": "b"
  },
  "math-09": {
    "kind": "single",
    "correct": "c"
  },
  "math-10": {
    "kind": "single",
    "correct": "c"
  },
  "math-11": {
    "kind": "single",
    "correct": "a"
  },
  "math-12": {
    "kind": "single",
    "correct": "b"
  },
  "math-13": {
    "kind": "single",
    "correct": "b"
  },
  "math-14": {
    "kind": "single",
    "correct": "b"
  },
  "math-15": {
    "kind": "single",
    "correct": "b"
  },
  "math-16": {
    "kind": "single",
    "correct": "c"
  },
  "math-17": {
    "kind": "single",
    "correct": "b"
  },
  "math-18": {
    "kind": "single",
    "correct": "b"
  },
  "math-19": {
    "kind": "single",
    "correct": "b"
  },
  "math-20": {
    "kind": "single",
    "correct": "b"
  },
  "math-21": {
    "kind": "single",
    "correct": "c"
  },
  "math-22": {
    "kind": "single",
    "correct": "b"
  },
  "math-23": {
    "kind": "single",
    "correct": "b"
  },
  "math-24": {
    "kind": "single",
    "correct": "b"
  },
  "math-25": {
    "kind": "manual"
  },
  "math-26": {
    "kind": "manual"
  },
  "math-27": {
    "kind": "manual"
  },
  "math-28": {
    "kind": "manual"
  },
  "nsi-01": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-02": {
    "kind": "single",
    "correct": "a"
  },
  "nsi-03": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-04": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-05": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-06": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-07": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-08": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-09": {
    "kind": "single",
    "correct": "a"
  },
  "nsi-10": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-11": {
    "kind": "single",
    "correct": "a"
  },
  "nsi-12": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-13": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-14": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-15": {
    "kind": "single",
    "correct": "a"
  },
  "nsi-16": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-17": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-18": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-19": {
    "kind": "single",
    "correct": "d"
  },
  "nsi-20": {
    "kind": "single",
    "correct": "a"
  },
  "nsi-21": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-22": {
    "kind": "single",
    "correct": "b"
  },
  "nsi-23": {
    "kind": "manual"
  },
  "nsi-24": {
    "kind": "manual"
  },
  "nsi-25": {
    "kind": "manual"
  },
  "nsi-26": {
    "kind": "manual"
  },
  "ses-01": {
    "kind": "single",
    "correct": "b"
  },
  "ses-02": {
    "kind": "single",
    "correct": "a"
  },
  "ses-03": {
    "kind": "single",
    "correct": "b"
  },
  "ses-04": {
    "kind": "single",
    "correct": "a"
  },
  "ses-05": {
    "kind": "single",
    "correct": "b"
  },
  "ses-06": {
    "kind": "single",
    "correct": "b"
  },
  "ses-07": {
    "kind": "single",
    "correct": "b"
  },
  "ses-08": {
    "kind": "single",
    "correct": "b"
  },
  "ses-09": {
    "kind": "single",
    "correct": "b"
  },
  "ses-10": {
    "kind": "single",
    "correct": "b"
  },
  "ses-11": {
    "kind": "single",
    "correct": "a"
  },
  "ses-12": {
    "kind": "single",
    "correct": "b"
  },
  "ses-13": {
    "kind": "single",
    "correct": "b"
  },
  "ses-14": {
    "kind": "single",
    "correct": "b"
  },
  "ses-15": {
    "kind": "single",
    "correct": "b"
  },
  "ses-16": {
    "kind": "single",
    "correct": "b"
  },
  "ses-17": {
    "kind": "single",
    "correct": "b"
  },
  "ses-18": {
    "kind": "single",
    "correct": "b"
  },
  "ses-19": {
    "kind": "manual"
  },
  "ses-20": {
    "kind": "manual"
  },
  "ses-21": {
    "kind": "manual"
  },
  "ses-22": {
    "kind": "manual"
  },
  "tc-01": {
    "kind": "single",
    "correct": "b"
  },
  "tc-02": {
    "kind": "single",
    "correct": "b"
  },
  "tc-03": {
    "kind": "single",
    "correct": "b"
  },
  "tc-04": {
    "kind": "single",
    "correct": "b"
  },
  "tc-05": {
    "kind": "single",
    "correct": "b"
  },
  "tc-06": {
    "kind": "single",
    "correct": "a"
  },
  "tc-07": {
    "kind": "single",
    "correct": "b"
  },
  "tc-08": {
    "kind": "single",
    "correct": "b"
  },
  "tc-09": {
    "kind": "single",
    "correct": "b"
  },
  "tc-10": {
    "kind": "single",
    "correct": "b"
  },
  "tc-11": {
    "kind": "single",
    "correct": "b"
  },
  "tc-12": {
    "kind": "single",
    "correct": "a"
  },
  "tc-en-info": {
    "kind": "neutral"
  },
  "tc-13": {
    "kind": "single",
    "correct": "b"
  },
  "tc-14": {
    "kind": "single",
    "correct": "b"
  },
  "tc-15": {
    "kind": "single",
    "correct": "b"
  },
  "tc-16": {
    "kind": "single",
    "correct": "b"
  },
  "tc-17": {
    "kind": "single",
    "correct": "b"
  },
  "tc-18": {
    "kind": "single",
    "correct": "a"
  },
  "tc-19": {
    "kind": "manual"
  },
  "tc-20": {
    "kind": "neutral"
  },
  "tc-21": {
    "kind": "manual"
  },
  "tc-22": {
    "kind": "single",
    "correct": "b"
  },
  "tc-23": {
    "kind": "single",
    "correct": "b"
  },
  "tc-24": {
    "kind": "manual"
  },
  "tc-25": {
    "kind": "manual"
  },
  "tc-26": {
    "kind": "manual"
  },
  "go-01": {
    "kind": "neutral"
  },
  "go-02": {
    "kind": "single",
    "correct": "b"
  },
  "go-03": {
    "kind": "single",
    "correct": "b"
  },
  "go-04": {
    "kind": "single",
    "correct": "b"
  },
  "go-05": {
    "kind": "neutral"
  },
  "go-06": {
    "kind": "manual"
  },
  "go-07": {
    "kind": "manual"
  },
  "go-08": {
    "kind": "manual"
  },
  "go-09": {
    "kind": "manual"
  },
  "go-10": {
    "kind": "manual"
  },
  "go-11": {
    "kind": "neutral"
  },
  "go-12": {
    "kind": "neutral"
  },
  "t0-01": {
    "kind": "single",
    "correct": "a"
  },
  "t0-02": {
    "kind": "single",
    "correct": "b"
  },
  "t0-03": {
    "kind": "single",
    "correct": "b"
  },
  "t0-04": {
    "kind": "single",
    "correct": "b"
  },
  "t0-05": {
    "kind": "single",
    "correct": "a"
  },
  "t0-06": {
    "kind": "single",
    "correct": "c"
  },
  "t0-07": {
    "kind": "single",
    "correct": "b"
  },
  "t0-08": {
    "kind": "single",
    "correct": "b"
  },
  "t0-09": {
    "kind": "single",
    "correct": "c"
  },
  "t0-10": {
    "kind": "single",
    "correct": "b"
  },
  "rem-info": {
    "kind": "neutral"
  },
  "rem-01": {
    "kind": "ack",
    "expected": true
  },
  "rem-02": {
    "kind": "manual"
  },
  "t1-01": {
    "kind": "single",
    "correct": "a"
  },
  "t1-02": {
    "kind": "single",
    "correct": "b"
  },
  "t1-03": {
    "kind": "single",
    "correct": "a"
  },
  "t1-04": {
    "kind": "single",
    "correct": "b"
  },
  "t1-05": {
    "kind": "single",
    "correct": "a"
  },
  "t1-06": {
    "kind": "single",
    "correct": "c"
  },
  "t1-07": {
    "kind": "single",
    "correct": "a"
  },
  "t1-08": {
    "kind": "single",
    "correct": "b"
  },
  "t1-09": {
    "kind": "single",
    "correct": "c"
  },
  "t1-10": {
    "kind": "single",
    "correct": "a"
  },
  "ret-03": {
    "kind": "manual"
  },
  "ret-04": {
    "kind": "manual"
  },
  "ret-05": {
    "kind": "manual"
  },
  "ret-06": {
    "kind": "numeric",
    "value": 8.333,
    "tolerance": 0.6
  },
  "ret-07": {
    "kind": "manual"
  },
  "ret-08": {
    "kind": "manual"
  },
  "ret-01": {
    "kind": "single",
    "correct": "b"
  },
  "ret-02": {
    "kind": "single",
    "correct": "a"
  },
  "doc-01": {
    "kind": "manual"
  },
  "doc-02": {
    "kind": "manual"
  },
  "doc-03": {
    "kind": "manual"
  },
  "doc-04": {
    "kind": "manual"
  },
  "doc-05": {
    "kind": "manual"
  },
  "doc-06": {
    "kind": "manual"
  },
  "doc-07": {
    "kind": "manual"
  },
  "doc-08": {
    "kind": "manual"
  },
  "doc-09": {
    "kind": "manual"
  },
  "final-01": {
    "kind": "ack",
    "expected": true
  },
  "final-02": {
    "kind": "ack",
    "expected": true
  },
  "final-03": {
    "kind": "ack",
    "expected": true
  },
  "final-04": {
    "kind": "neutral"
  },
  "final-05": {
    "kind": "manual"
  },
  "final-06": {
    "kind": "manual"
  },
  "final-07": {
    "kind": "neutral"
  },
  "final-08": {
    "kind": "manual"
  },
  "parent-01": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-02": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-03": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-04": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-05": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-06": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-07": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-08": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-09": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-10": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-11": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-12": {
    "kind": "scale",
    "min": 1,
    "max": 5,
    "direction": 1
  },
  "parent-13": {
    "kind": "neutral"
  },
  "parent-14": {
    "kind": "manual"
  },
  "parent-15": {
    "kind": "neutral"
  },
  "parent-16": {
    "kind": "neutral"
  },
  "parent-17": {
    "kind": "manual"
  },
  "parent-18": {
    "kind": "neutral"
  },
  "parent-19": {
    "kind": "neutral"
  },
  "parent-20": {
    "kind": "manual"
  },
  "parent-21": {
    "kind": "neutral"
  },
  "parent-22": {
    "kind": "ack",
    "expected": true
  }
};
