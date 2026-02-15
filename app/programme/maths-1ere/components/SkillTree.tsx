'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { programmeData } from '../data';
import { useMathsLabStore } from '../store';

/**
 * Skill Tree DAG visualization.
 * Renders chapters as nodes in a directed acyclic graph with prerequisite edges.
 * Replaces the flat chapter list with a visual skill tree.
 */

interface SkillTreeProps {
  /** Callback when a chapter node is clicked */
  onSelectChapter: (ch: { catKey: string; chapId: string }) => void;
  /** Currently selected chapter */
  selectedChapterId?: string;
}

interface TreeNode {
  id: string;
  titre: string;
  catKey: string;
  couleur: string;
  icon: string;
  difficulte: number;
  pointsXP: number;
  prerequis: string[];
  col: number;
  row: number;
}

/**
 * Build a flat list of all chapter nodes with layout positions.
 * Uses topological sort to determine row positions.
 */
function buildTreeNodes(): TreeNode[] {
  const nodes: TreeNode[] = [];
  const idToNode = new Map<string, TreeNode>();

  // Collect all nodes
  let colIdx = 0;
  for (const [catKey, cat] of Object.entries(programmeData)) {
    for (const chap of cat.chapitres) {
      const node: TreeNode = {
        id: chap.id,
        titre: chap.titre,
        catKey,
        couleur: cat.couleur,
        icon: cat.icon,
        difficulte: chap.difficulte,
        pointsXP: chap.pointsXP,
        prerequis: chap.prerequis ?? [],
        col: colIdx,
        row: 0,
      };
      nodes.push(node);
      idToNode.set(chap.id, node);
    }
    colIdx++;
  }

  // Topological sort for row assignment
  const visited = new Set<string>();
  const depths = new Map<string, number>();

  function getDepth(id: string): number {
    if (depths.has(id)) return depths.get(id)!;
    if (visited.has(id)) return 0;
    visited.add(id);

    const node = idToNode.get(id);
    if (!node || node.prerequis.length === 0) {
      depths.set(id, 0);
      return 0;
    }

    let maxParentDepth = 0;
    for (const prereq of node.prerequis) {
      if (idToNode.has(prereq)) {
        maxParentDepth = Math.max(maxParentDepth, getDepth(prereq) + 1);
      }
    }
    depths.set(id, maxParentDepth);
    return maxParentDepth;
  }

  for (const node of nodes) {
    node.row = getDepth(node.id);
  }

  return nodes;
}

const colorClasses: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  cyan: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/50', text: 'text-cyan-400', glow: 'shadow-cyan-500/20' },
  blue: { bg: 'bg-blue-500/20', border: 'border-blue-500/50', text: 'text-blue-400', glow: 'shadow-blue-500/20' },
  purple: { bg: 'bg-purple-500/20', border: 'border-purple-500/50', text: 'text-purple-400', glow: 'shadow-purple-500/20' },
  amber: { bg: 'bg-amber-500/20', border: 'border-amber-500/50', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  green: { bg: 'bg-green-500/20', border: 'border-green-500/50', text: 'text-green-400', glow: 'shadow-green-500/20' },
};

export default function SkillTree({ onSelectChapter, selectedChapterId }: SkillTreeProps) {
  const store = useMathsLabStore();
  const nodes = useMemo(() => buildTreeNodes(), []);

  // Group nodes by category column
  const columns = useMemo(() => {
    const cols = new Map<number, TreeNode[]>();
    for (const node of nodes) {
      const list = cols.get(node.col) ?? [];
      list.push(node);
      cols.set(node.col, list);
    }
    // Sort each column by row
    for (const list of cols.values()) {
      list.sort((a, b) => a.row - b.row);
    }
    return cols;
  }, [nodes]);

  // Category headers
  const catEntries = Object.entries(programmeData);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🌳</span>
        <h3 className="font-bold text-white text-sm">Arbre de Compétences</h3>
        <span className="text-xs text-slate-500">
          {store.completedChapters.length}/{nodes.length} débloqués
        </span>
      </div>

      {/* Render by category */}
      <div className="space-y-3">
        {catEntries.map(([catKey, cat], colIdx) => {
          const colNodes = columns.get(colIdx) ?? [];
          const colors = colorClasses[cat.couleur] ?? colorClasses.cyan;

          return (
            <div key={catKey} className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/30">
              <div className={`flex items-center gap-2 mb-2 ${colors.text}`}>
                <span>{cat.icon}</span>
                <span className="text-xs font-bold">{cat.titre}</span>
              </div>

              <div className="space-y-1">
                {colNodes.map((node, nodeIdx) => {
                  const isCompleted = store.completedChapters.includes(node.id);
                  const isLocked = node.prerequis.some(
                    (p) => !store.completedChapters.includes(p)
                  );
                  const isSelected = selectedChapterId === node.id;
                  const dueReviews = store.getDueReviews();
                  const isDue = dueReviews.includes(node.id);

                  return (
                    <motion.button
                      key={node.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: nodeIdx * 0.05 }}
                      onClick={() =>
                        !isLocked && onSelectChapter({ catKey: node.catKey, chapId: node.id })
                      }
                      disabled={isLocked}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 group ${
                        isLocked
                          ? 'opacity-40 cursor-not-allowed'
                          : isSelected
                          ? `${colors.bg} ${colors.border} border shadow-md ${colors.glow}`
                          : isCompleted
                          ? 'bg-slate-700/30 hover:bg-slate-700/60 border border-transparent'
                          : 'hover:bg-slate-700/40 border border-transparent'
                      }`}
                    >
                      {/* Status icon */}
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0 ${
                          isLocked
                            ? 'bg-slate-700 text-slate-500'
                            : isCompleted
                            ? 'bg-green-500/20 text-green-400'
                            : isDue
                            ? 'bg-amber-500/20 text-amber-400'
                            : `${colors.bg} ${colors.text}`
                        }`}
                      >
                        {isLocked ? '🔒' : isCompleted ? '✓' : isDue ? '🔄' : node.row + 1}
                      </div>

                      {/* Node info */}
                      <div className="flex-1 min-w-0">
                        <div className={`font-medium truncate ${isCompleted ? 'text-slate-300' : 'text-white'}`}>
                          {node.titre}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span>{'★'.repeat(node.difficulte)}{'☆'.repeat(5 - node.difficulte)}</span>
                          <span>{node.pointsXP} XP</span>
                          {isDue && <span className="text-amber-400 font-bold">À réviser</span>}
                        </div>
                      </div>

                      {/* Prerequisite indicator */}
                      {node.prerequis.length > 0 && !isLocked && (
                        <div className="text-[10px] text-slate-600 shrink-0" title={`Prérequis: ${node.prerequis.join(', ')}`}>
                          ←{node.prerequis.length}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
