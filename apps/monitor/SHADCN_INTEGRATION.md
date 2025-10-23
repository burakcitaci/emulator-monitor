# Shadcn/UI Integration Guide

## ✅ Setup Complete

Shadcn/UI has been successfully integrated into your NX workspace with Yarn. Here's what was configured:

### Installed Dependencies

- `clsx` - Utility for constructing className strings
- `tailwind-merge` - Utility for merging Tailwind CSS classes
- `class-variance-authority` - For creating variant-based components
- `tailwindcss-animate` - Animation utilities for Tailwind CSS

### Installed Shadcn/UI Components

- ✅ Button
- ✅ Card
- ✅ Table
- ✅ Input
- ✅ Textarea
- ✅ Badge
- ✅ Label
- ✅ Select
- ✅ Popover

All components are located in: `apps/monitor/src/app/components/ui/`

### Configuration Files

1. **`components.json`** - Shadcn/UI configuration
2. **`tailwind.config.js`** - Tailwind CSS with shadcn theme
3. **`src/styles.css`** - CSS variables for theming
4. **`src/app/lib/utils.ts`** - `cn()` utility function

## 📝 Usage Examples

### Using Button Component

```tsx
import { Button } from './components/ui/button';

// Primary button
<Button>Click me</Button>

// Variants
<Button variant="outline">Outline</Button>
<Button variant="ghost">Ghost</Button>
<Button variant="destructive">Delete</Button>

// Sizes
<Button size="sm">Small</Button>
<Button size="lg">Large</Button>

// With icons
<Button>
  <Send className="w-4 h-4 mr-2" />
  Send Message
</Button>
```

### Using Card Component

```tsx
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
    <CardDescription>Card description goes here</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Card content</p>
  </CardContent>
</Card>;
```

### Using Input Component

```tsx
import { Input } from './components/ui/input';
import { Label } from './components/ui/label';

<div className="space-y-2">
  <Label htmlFor="email">Email</Label>
  <Input id="email" type="email" placeholder="Enter your email" />
</div>;
```

### Using Table Component

```tsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {data.map((item) => (
      <TableRow key={item.id}>
        <TableCell>{item.name}</TableCell>
        <TableCell>{item.status}</TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>;
```

### Using Badge Component

```tsx
import { Badge } from './components/ui/badge';

<Badge>Default</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outline</Badge>
```

### Using Select Component

```tsx
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './components/ui/select';

<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Select an option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>;
```

## 🎨 Theming

Shadcn/UI uses CSS variables for theming. You can customize colors in `src/styles.css`:

```css
:root {
  --primary: 221.2 83.2% 53.3%;
  --secondary: 210 40% 96%;
  --destructive: 0 84.2% 60.2%;
  --muted: 210 40% 96%;
  --accent: 210 40% 96%;
  /* ... more variables */
}
```

## 🚀 Adding More Components

To add more shadcn/ui components:

```bash
cd apps/monitor
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add toast
# etc.
```

After adding, move the component from the nested `ui/ui/` folder to `ui/`:

```bash
mv src/app/components/ui/ui/dialog.tsx src/app/components/ui/dialog.tsx
rmdir src/app/components/ui/ui
```

## 📦 Available Components to Add

- `alert` - Alert messages
- `alert-dialog` - Modal dialogs
- `avatar` - User avatars
- `checkbox` - Checkboxes
- `dialog` - Dialogs/Modals
- `dropdown-menu` - Dropdown menus
- `form` - Form components
- `radio-group` - Radio buttons
- `scroll-area` - Scrollable areas
- `separator` - Dividers
- `sheet` - Side panels
- `skeleton` - Loading skeletons
- `switch` - Toggle switches
- `tabs` - Tab components
- `toast` - Toast notifications
- `tooltip` - Tooltips

And many more! Visit [ui.shadcn.com](https://ui.shadcn.com) for the full list.

## 🔧 Utility Function

The `cn()` utility function merges Tailwind CSS classes smartly:

```tsx
import { cn } from '../lib/utils';

// Merges classes and handles conflicts
<div
  className={cn(
    'base-class',
    isActive && 'active-class',
    className, // Additional classes from props
  )}
/>;
```

## 💡 Best Practices

1. **Use the `cn()` utility** for conditional classes
2. **Leverage variants** for consistent styling across your app
3. **Customize colors** in CSS variables for brand consistency
4. **Keep components in `ui/` folder** separate from feature components
5. **Use semantic HTML** - shadcn components are accessible by default

## 🎯 Next Steps

The following components in your app have been updated to use shadcn/ui:

- ✅ `SendMessageTab` - Using Button, Input, Textarea, Label
- ✅ `MessageFilters` - Using Button, Input, Select

You can now update the remaining components:

- `MessageTable` - Can use Table, Badge, Button components
- `DLQTable` - Can use Table, Badge, Button components
- `Header` - Can use Badge components for status indicators
- `Configuration` - Can use Card, Button, Input, Label components
- `MessageDetailModal` - Can use Dialog component (need to install it)

## 🐛 Troubleshooting

If you encounter path issues when adding components:

1. Check `components.json` - ensure paths are correct
2. Move files from nested `ui/ui/` to `ui/` folder
3. Restart your dev server after adding new components

## 📚 Resources

- [Shadcn/UI Documentation](https://ui.shadcn.com)
- [Tailwind CSS Documentation](https://tailwindcss.com)
- [Radix UI Documentation](https://radix-ui.com) (underlying component library)
