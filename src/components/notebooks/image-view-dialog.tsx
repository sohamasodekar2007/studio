// src/components/notebooks/image-view-dialog.tsx
'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import { X } from "lucide-react";

interface ImageViewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText: string;
}

export default function ImageViewDialog({ isOpen, onClose, imageUrl, altText }: ImageViewDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Image Preview</DialogTitle>
          <DialogDescription>
            {altText}
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-auto p-1 flex items-center justify-center">
           <Image
             src={imageUrl}
             alt={altText}
             width={1000} // Set a large width constraint
             height={800} // Set a large height constraint
             style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain' }} // Ensure responsive fit
             className="rounded-md"
             data-ai-hint="question image"
             unoptimized // Good for local/dynamic images
             onError={(e) => { console.error("Error loading image in dialog:", imageUrl, e); }}
           />
        </div>
        <DialogFooter className="mt-2 sm:justify-end">
           <Button type="button" variant="outline" onClick={onClose}>
             <X className="mr-2 h-4 w-4" /> Close
           </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}