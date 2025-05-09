// src/components/admin/json-editor-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface JsonEditorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  jsonString: string;
  onSave: (editedJson: string) => void; // Callback to handle saving/using the edited JSON
}

export default function JsonEditorDialog({
  isOpen,
  onClose,
  jsonString,
  onSave,
}: JsonEditorDialogProps) {
  const [editedJson, setEditedJson] = useState(jsonString);
  const [isValidJson, setIsValidJson] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setEditedJson(jsonString);
    try {
      JSON.parse(jsonString);
      setIsValidJson(true);
    } catch (e) {
      setIsValidJson(false);
    }
  }, [jsonString, isOpen]);

  const handleTextChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = event.target.value;
    setEditedJson(newText);
    try {
      JSON.parse(newText);
      setIsValidJson(true);
    } catch (e) {
      setIsValidJson(false);
    }
  };

  const handleApplyChanges = () => {
    if (!isValidJson) {
      toast({
        variant: 'destructive',
        title: 'Invalid JSON',
        description: 'The JSON content is not valid. Please correct it before applying.',
      });
      return;
    }
    onSave(editedJson);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>View/Edit Sample JSON</DialogTitle>
          <DialogDescription>
            Review or modify the sample JSON for bulk question upload. Ensure the format is correct.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-grow overflow-hidden py-4">
          <Textarea
            value={editedJson}
            onChange={handleTextChange}
            rows={15}
            className={`font-mono text-xs w-full h-full resize-none ${!isValidJson ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            placeholder="Paste or edit JSON here..."
          />
          {!isValidJson && (
            <p className="text-xs text-destructive mt-1">Invalid JSON format.</p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={handleApplyChanges} disabled={!isValidJson}>
            Apply to Text Area
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
