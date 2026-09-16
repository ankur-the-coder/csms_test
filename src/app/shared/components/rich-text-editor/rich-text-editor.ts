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
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';

@Component({
  selector: 'app-rich-text-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rich-text-editor.html',
  styleUrl: './rich-text-editor.css',
})
export class RichTextEditor implements AfterViewInit, OnDestroy {
  @ViewChild('editorEl', { static: true }) editorEl!: ElementRef<HTMLElement>;
  @ViewChild('linkInput') linkInput?: ElementRef<HTMLInputElement>;
  @Input() initialContent = '';
  @Output() contentChange = new EventEmitter<string>();

  editor!: Editor;

  // Link Modal State
  isLinkModalOpen = false;
  linkUrl = '';
  linkText = '';
  openInNewTab = true;
  isEditingExistingLink = false;

  ngAfterViewInit(): void {
    this.editor = new Editor({
      element: this.editorEl.nativeElement,
      extensions: [
        StarterKit,
        Underline,
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            class: 'rte-link',
          },
        }),
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

  openLinkModal(): void {
    if (!this.editor) return;

    const previousUrl = this.editor.getAttributes('link')?.['href'] || '';
    const { from, to } = this.editor.state.selection;
    const selectedText = this.editor.state.doc.textBetween(from, to, ' ');

    this.linkUrl = previousUrl;
    this.linkText = selectedText || '';
    this.openInNewTab = previousUrl ? (this.editor.getAttributes('link')?.['target'] === '_blank') : true;
    this.isEditingExistingLink = !!previousUrl;
    this.isLinkModalOpen = true;

    setTimeout(() => {
      if (this.linkInput?.nativeElement) {
        this.linkInput.nativeElement.focus();
        this.linkInput.nativeElement.select();
      }
    }, 60);
  }

  closeLinkModal(): void {
    this.isLinkModalOpen = false;
    this.linkUrl = '';
    this.linkText = '';
    this.editor?.commands.focus();
  }

  applyLink(): void {
    let url = (this.linkUrl || '').trim();
    if (!url) {
      if (this.isEditingExistingLink) {
        this.removeLink();
      } else {
        this.closeLinkModal();
      }
      return;
    }

    if (!/^https?:\/\//i.test(url) && !/^mailto:/i.test(url) && !/^tel:/i.test(url) && !/^#/i.test(url)) {
      url = `https://${url}`;
    }

    const linkAttrs: { href: string; target?: string | null } = {
      href: url,
      target: this.openInNewTab ? '_blank' : null,
    };

    if (this.linkText && this.editor.state.selection.empty) {
      const targetAttr = this.openInNewTab ? ' target="_blank"' : '';
      this.editor.chain().focus().insertContent(`<a href="${url}"${targetAttr}>${this.linkText}</a>`).run();
    } else {
      this.editor.chain().focus().extendMarkRange('link').setLink(linkAttrs).run();
    }

    this.closeLinkModal();
  }

  removeLink(): void {
    this.editor?.chain().focus().unsetLink().run();
    this.closeLinkModal();
  }

  setContent(html: string): void {
    this.editor?.commands.setContent(html);
  }

  ngOnDestroy(): void {
    this.editor?.destroy();
  }
}