
import { Shuffle } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../../../components/ui/sheet";
import { MessagingResource } from "../lib/entities";
import { uniqueNamesGenerator, Config, adjectives, names, } from 'unique-names-generator';

const config: Config = {
  dictionaries: [adjectives, names],
  separator: '-',
  length: 2,
  style: 'lowerCase',
};

interface DetailSheetProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  editing: boolean;
  form: MessagingResource;
  setForm: (form: MessagingResource) => void;
  handleSave: () => void;
}
export const DetailSheet = ({ open, setOpen, editing, form, setForm, handleSave }: DetailSheetProps) => {
  return (
    <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>
              {editing ? 'Edit Resource' : 'Create Resource'}
            </SheetTitle>
          </SheetHeader>

          <div className="grid gap-4 mt-6">
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="name">Name</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm({ ...form, name: uniqueNamesGenerator(config) })}
                  className="h-7 text-xs"
                >
                  <Shuffle className="mr-1 h-3 w-3" />
                  Random Name
                </Button>
              </div>
              <Input id="name" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v: 'aws' | 'azure') =>
                    setForm({ ...form, provider: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: 'queue' | 'topic') =>
                    setForm({ ...form, type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queue">Queue</SelectItem>
                    <SelectItem value="topic">Topic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full mt-4">
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
  );
};