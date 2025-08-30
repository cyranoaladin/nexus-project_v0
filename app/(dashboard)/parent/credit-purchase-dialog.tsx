'use client';
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

interface CreditPurchaseDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    childId: string;
    onPurchaseSuccess: () => void;
}

export default function CreditPurchaseDialog({ open, onOpenChange }: CreditPurchaseDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Acheter des crédits</DialogTitle>
                    <DialogDescription>
                        Module d'achat de crédits (placeholder).
                    </DialogDescription>
                </DialogHeader>
                {/* Content would go here */}
                <DialogFooter>
                    <Button>Payer</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


