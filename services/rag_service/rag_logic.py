# services/rag_service/rag_logic.py
# Implémentation minimale pour l'ingestion intelligente
from dataclasses import dataclass
from typing import Dict, Any

@dataclass
class DocumentPedagogique:
    contenu: str
    metadata: Dict[str, Any]

class AnalyseurContenuPedagogique:
    def __init__(self) -> None:
        pass

    def analyser(self, contenu: str, metadata: Dict[str, Any]) -> DocumentPedagogique:
        # Ici, on pourrait normaliser, extraire des mots-clés, etc.
        return DocumentPedagogique(contenu=contenu.strip(), metadata=metadata)

class RagIndex:
    def __init__(self) -> None:
        self._count = 0

    def ajouter_document(self, doc: DocumentPedagogique) -> str:
        self._count += 1
        return f"doc-{self._count}"

# Instance globale (mockable en tests)
rag_index = RagIndex()
