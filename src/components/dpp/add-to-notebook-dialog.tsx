// src/components/dpp/add-to-notebook-dialog.tsx
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import type { Notebook, BookmarkTag } from '@/types';
import { bookmarkTags } from '@/types';
import { PlusCircle, Loader2, Tag, Pencil } from 'lucide-react';
import { createNotebook } from '@/actions/notebook-actions'; // Import createNotebook action
import { useToast } from '@/hooks/use-toast';

interface AddToNotebookDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notebooks: Notebook[];
  onSave: (selectedNotebookIds: string[], tags: BookmarkTag[]) => Promise<void>;
  isLoading: boolean;
  userId: string; // Needed for creating notebooks
  onNotebookCreated: (newNotebook: Notebook) => void; // Callback to update parent state
}

export default function AddToNotebookDialog({
  isOpen,
  onClose,
  notebooks,
  onSave,
  isLoading,
  userId,
  onNotebookCreated,
}: AddToNotebookDialogProps) {
  const { toast } = useToast();
  const [selectedNotebookIds, setSelectedNotebookIds] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<BookmarkTag[]>([]);
  const [showCreateNotebook, setShowCreateNotebook] = useState(false);
  const [newNotebookName, setNewNotebookName] = useState('');
  const [isCreatingNotebook, setIsCreatingNotebook] = useState(false);

  // Reset state when dialog opens/closes or notebooks change
  useEffect(() => {
    if (isOpen) {
      setSelectedNotebookIds([]);
      setSelectedTags([]);
      setShowCreateNotebook(false);
      setNewNotebookName('');
    }
  }, [isOpen, notebooks]);

  const handleNotebookSelectionChange = (notebookId: string, checked: boolean) => {
    setSelectedNotebookIds(prev =>
      checked ? [...prev, notebookId] : prev.filter(id => id !== notebookId)
    );
  };

  const handleTagSelection = (tag: BookmarkTag) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleCreateNotebook = async () => {
      if (!newNotebookName.trim()) {
          toast({ variant: "destructive", title: "Notebook name cannot be empty." });
          return;
      }
      setIsCreatingNotebook(true);
      try {
          const result = await createNotebook(userId, newNotebookName.trim());
          if (result.success && result.notebook) {
                toast({ title: "Notebook Created", description: `"${result.notebook.name}" added.` });
                onNotebookCreated(result.notebook); // Update notebooks list in parent
                setNewNotebookName('');
                setShowCreateNotebook(false);
                 // Automatically select the newly created notebook
                 setSelectedNotebookIds(prev => [...prev, result.notebook!.id]);
          } else {
              throw new Error(result.message || "Failed to create notebook.");
          }
      } catch (error: any) {
            toast({ variant: "destructive", title: "Creation Failed", description: error.message });
      } finally {
            setIsCreatingNotebook(false);
      }
  };

  const handleSaveClick = () => {
    if (selectedNotebookIds.length === 0) {
        toast({ variant: "destructive", title: "No Notebook Selected", description: "Please select at least one notebook." });
        return;
    }
    onSave(selectedNotebookIds, selectedTags);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to Notebooks</DialogTitle>
          <DialogDescription>Select notebooks and optionally add tags.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
            {!showCreateNotebook && (
                 <Button variant="outline" size="sm" onClick={() => setShowCreateNotebook(true)} className="w-full">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create New Notebook
                </Button>
            )}

             {showCreateNotebook && (
                <div className="flex items-center space-x-2 p-3 border rounded-md bg-muted/50">
                    <Input
                        placeholder="New notebook name..."
                        value={newNotebookName}
                        onChange={(e) => setNewNotebookName(e.target.value)}
                        disabled={isCreatingNotebook}
                        className="flex-grow"
                    />
                     <Button size="sm" onClick={handleCreateNotebook} disabled={isCreatingNotebook || !newNotebookName.trim()}>
                        {isCreatingNotebook ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
                     </Button>
                     <Button variant="ghost" size="sm" onClick={() => setShowCreateNotebook(false)} disabled={isCreatingNotebook}>
                        Cancel
                    </Button>
                </div>
            )}

          <Label>Select Notebook(s)</Label>
          <ScrollArea className="h-32 w-full rounded-md border p-3">
            {notebooks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No notebooks created yet.</p>
            ) : (
              notebooks.map((notebook) => (
                <div key={notebook.id} className="flex items-center space-x-2 mb-2 p-1.5 rounded hover:bg-muted/50">
                  <Checkbox
                    id={`notebook-${notebook.id}`}
                    checked={selectedNotebookIds.includes(notebook.id)}
                    onCheckedChange={(checked) => handleNotebookSelectionChange(notebook.id, !!checked)}
                  />
                  <Label htmlFor={`notebook-${notebook.id}`} className="text-sm font-normal flex-grow cursor-pointer">
                    {notebook.name}
                  </Label>
                </div>
              ))
            )}
          </ScrollArea>

          <div className="space-y-2">
            <Label>Add Tags (Optional)</Label>
            <div className="flex flex-wrap gap-2">
              {bookmarkTags.map((tag) => (
                <Button
                  key={tag}
                  variant={selectedTags.includes(tag) ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => handleTagSelection(tag)}
                  className={cn("text-xs h-7 px-2.5", selectedTags.includes(tag) && "bg-primary/10 text-primary border-primary/30")}
                >
                  <Tag className="mr-1 h-3 w-3" /> {tag}
                </Button>
              ))}
              {/* Placeholder for edit/create tags */}
              {/* <Button variant="ghost" size="sm" className="text-xs h-7 px-2.5 text-muted-foreground"> <Pencil className="mr-1 h-3 w-3"/> Edit Tags </Button> */}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button type="button" onClick={handleSaveClick} disabled={isLoading || selectedNotebookIds.length === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save to Notebooks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
