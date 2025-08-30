'use client';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

export default function InvoiceDetailsDialog() {
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline">Voir les factures</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Détails de facturation</DialogTitle>
                    <DialogDescription>
                        Liste des factures (placeholder).
                    </DialogDescription>
                </DialogHeader>
                {/* Invoice list would go here */}
            </DialogContent>
        </Dialog>
    );
}


