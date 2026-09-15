import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
})
export class RichTextEditor implements AfterViewInit, OnDestroy {
  @ViewChild('editorEl', { static: true }) editorEl!: ElementRef<HTMLElement>;
  @Input() initialContent = '';
  @Output() contentChange = new EventEmitter<string>();

  editor!: Editor;

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorEl.nativeElement,
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false }),
      ],
      content: this.initialContent,
      editorProps: {
      attributes: {
        style: 'outline: none; border: none; box-shadow: none;',
      },
    },
      onUpdate: ({ editor }) => {
        this.contentChange.emit(editor.getHTML());
      },
    });
  }

  isActive(name: string, attrs: Record<string, any> = {}): boolean {
    return this.editor?.isActive(name, attrs) ?? false;
  }

  toggleBold(): void { this.editor.chain().focus().toggleBold().run(); }
  toggleItalic(): void { this.editor.chain().focus().toggleItalic().run(); }
  toggleUnderline(): void { this.editor.chain().focus().toggleUnderline().run(); }
  toggleStrike(): void { this.editor.chain().focus().toggleStrike().run(); }
  toggleBulletList(): void { this.editor.chain().focus().toggleBulletList().run(); }
  toggleOrderedList(): void { this.editor.chain().focus().toggleOrderedList().run(); }
  toggleBlockquote(): void { this.editor.chain().focus().toggleBlockquote().run(); }
  undo(): void { this.editor.chain().focus().undo().run(); }
  redo(): void { this.editor.chain().focus().redo().run(); }

  setLink(): void {
    const url = window.prompt('Enter URL');
    if (url) {
      this.editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      this.editor.chain().focus().unsetLink().run();
    }
  }

  setContent(html: string): void {
    this.editor?.commands.setContent(html);
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}