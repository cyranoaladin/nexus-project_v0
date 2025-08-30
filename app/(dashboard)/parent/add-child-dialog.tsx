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
import { PlusCircle } from "lucide-react";

export default function AddChildDialog({ onChildAdded }: { onChildAdded: () => void }) {
    // Basic placeholder component
    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button variant="outline"><PlusCircle className="w-4 h-4 mr-2" /> Ajouter</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Ajouter un enfant</DialogTitle>
                    <DialogDescription>
                        Formulaire pour ajouter un enfant (placeholder).
                    </DialogDescription>
                </DialogHeader>
                {/* Form would go here */}
                <DialogFooter>
                    <Button type="submit">Sauvegarder</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


