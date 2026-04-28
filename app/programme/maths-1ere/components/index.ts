// Ré-exports pour rétrocompatibilité après extraction vers components/programme/shared/
// Seuls les composants vraiment partagés (sans dépendances maths-1ere) sont extraits.

export { MathJaxProvider, useMathJax } from '@/components/programme/shared/MathJaxProvider';
export { default as MathInput } from '@/components/programme/shared/MathInput';
export { MathRichText } from '@/components/programme/shared/MathContent';
