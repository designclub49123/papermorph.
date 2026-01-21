import React, { useRef, useState, useCallback, useEffect } from 'react';
import { DocumentEditorContainerComponent, Toolbar } from '@syncfusion/ej2-react-documenteditor';
import { Topbar } from './Topbar';
import { SidebarLeft } from './SidebarLeft';
import { SidebarRight } from './SidebarRight';
import MainToolbar from './editor/Toolbar';
import StatusBar from './StatusBar';
import MobileAIChat from './MobileAIChat';
import { useEditorStore } from '@/state/useEditorStore';
import { useUserStore } from '@/state/useUserStore';
import { useDocStore } from '@/state/useDocStore';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Inject Toolbar module
DocumentEditorContainerComponent.Inject(Toolbar);

const DocumentEditor: React.FC = () => {
  const editorRef = useRef<DocumentEditorContainerComponent | null>(null);
  const { setEditor } = useEditorStore();
  const { theme } = useUserStore();
  const { currentDocument } = useDocStore();
  const isMobile = useIsMobile();
  const [documentName, setDocumentName] = useState('Untitled Document');
  const [isSaved, setIsSaved] = useState(true);
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(2);
  const [isReady, setIsReady] = useState(false);
  const [activeFormats, setActiveFormats] = useState<string[]>([]);
  const [selectedFont, setSelectedFont] = useState('Inter');
  const [selectedFontSize, setSelectedFontSize] = useState('12');
  const [isTyping, setIsTyping] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isAutoSaving, setIsAutoSaving] = useState(false);
  const [typingTimeout, setTypingTimeout] = useState<NodeJS.Timeout | null>(null);

  // Apply theme from global store
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    // Apply theme to Syncfusion editor using CSS classes
    if (editorRef.current?.documentEditor) {
      const editorContainer = document.querySelector('#documentEditor');
      if (editorContainer) {
        // Remove existing theme classes
        editorContainer.classList.remove('e-dark-theme', 'e-light-theme');
        
        // Add appropriate theme class
        if (theme === 'dark') {
          editorContainer.classList.add('e-dark-theme');
          // Apply custom dark theme styles
          const style = document.createElement('style');
          style.id = 'editor-dark-theme';
          style.textContent = `
            #documentEditor .e-de-cnt-pg {
              background-color: #1a1a1a !important;
            }
            #documentEditor .e-de-document-text {
              color: #ffffff !important;
            }
            #documentEditor .e-de-cnt-pg-content {
              background-color: #1a1a1a !important;
            }
          `;
          document.head.appendChild(style);
        } else {
          editorContainer.classList.add('e-light-theme');
          // Remove dark theme styles
          const darkThemeStyle = document.getElementById('editor-dark-theme');
          if (darkThemeStyle) {
            darkThemeStyle.remove();
          }
        }
      }
    }
  }, [theme]);

  // Load document content when current document changes
  useEffect(() => {
    if (currentDocument && editorRef.current?.documentEditor && isReady) {
      const editor = editorRef.current.documentEditor;
      
      if (currentDocument.content) {
        try {
          // Simple approach: clear and insert text
          editor.selection.selectAll();
          editor.editor.delete();
          
          // Convert HTML to plain text and insert
          const plainText = currentDocument.content.replace(/<[^>]*>/g, '');
          editor.editor.insertText(plainText);
          
          setDocumentName(currentDocument.title);
          editor.focusIn();
        } catch (error) {
          console.error('Failed to load content:', error);
        }
      }
    }
  }, [currentDocument, isReady]);

  // Handle content change with auto-save
  const handleContentChange = useCallback(() => {
    if (editorRef.current?.documentEditor) {
      const editor = editorRef.current.documentEditor;
      setTotalPages(editor.pageCount || 1);
      setIsSaved(false);
      setIsTyping(true);
      
      // Get word count from content
      try {
        const content = editor.serialize();
        const text = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        setWordCount(text ? text.split(' ').length : 0);
        setCharacterCount(text.length);
      } catch {
        // Silent fail
      }

      // Update active formats
      updateActiveFormats();

      // Auto-save after typing stops
      if (typingTimeout) {
        clearTimeout(typingTimeout);
      }
      
      const newTimeout = setTimeout(() => {
        handleAutoSave();
        setIsTyping(false);
      }, 2000); // Auto-save 2 seconds after typing stops
      
      setTypingTimeout(newTimeout);
    }
  }, [typingTimeout]);

  // Auto-save functionality
  const handleAutoSave = useCallback(async () => {
    if (!editorRef.current?.documentEditor || isAutoSaving) return;
    
    setIsAutoSaving(true);
    try {
      const editor = editorRef.current.documentEditor;
      const content = editor.serialize();
      
      // Update current document in store
      if (currentDocument) {
        // This would update the document store with new content
        // For now, just save to localStorage
        localStorage.setItem('autosave_document', content);
        localStorage.setItem('autosave_name', documentName);
        setLastSaved(new Date());
        setIsSaved(true);
      }
    } catch (error) {
      console.error('Auto-save failed:', error);
    } finally {
      setIsAutoSaving(false);
    }
  }, [currentDocument, documentName, isAutoSaving]);

  // Update active formats based on current selection
  const updateActiveFormats = useCallback(() => {
    if (!editorRef.current?.documentEditor) return;
    
    const editor = editorRef.current.documentEditor;
    const selection = editor.selection;
    const formats: string[] = [];
    
    if (selection?.characterFormat) {
      if (selection.characterFormat.bold) formats.push('bold');
      if (selection.characterFormat.italic) formats.push('italic');
      if (selection.characterFormat.underline !== 'None') formats.push('underline');
      if (selection.characterFormat.strikethrough !== 'None') formats.push('strikethrough');
      if (selection.characterFormat.fontFamily) setSelectedFont(selection.characterFormat.fontFamily);
      if (selection.characterFormat.fontSize) setSelectedFontSize(selection.characterFormat.fontSize.toString());
    }
    
    setActiveFormats(formats);
  }, []);

  // Save document
  const handleSave = useCallback(() => {
    if (editorRef.current?.documentEditor) {
      const editor = editorRef.current.documentEditor;
      const content = editor.serialize();
      localStorage.setItem('autosave_document', content);
      localStorage.setItem('autosave_name', documentName);
      setIsSaved(true);
    }
  }, [documentName]);

  // Export as DOCX
  const handleExportDocx = useCallback(() => {
    if (editorRef.current?.documentEditor) {
      editorRef.current.documentEditor.save(documentName, 'Docx');
      setIsSaved(true);
    }
  }, [documentName]);

  // Export as PDF (uses DOCX as fallback)
  const handleExportPdf = useCallback(() => {
    if (editorRef.current?.documentEditor) {
      // PDF export requires server-side conversion
      // For now, export as DOCX
      editorRef.current.documentEditor.save(documentName, 'Docx');
    }
  }, [documentName]);

  // Handle toolbar actions with enhanced functionality and UX
  const handleToolbarAction = useCallback((action: string, value?: string) => {
    if (!editorRef.current?.documentEditor) {
      toast.error('Please wait for the editor to load');
      return;
    }
    
    const editor = editorRef.current.documentEditor;
    const selection = editor.selection;
    const editorModule = editor.editor;
    
    // Enhanced feedback with loading states
    const showActionFeedback = (actionName: string, duration = 1000) => {
      toast.success(`${actionName}`, { duration });
    };
    
    const showError = (error: string) => {
      toast.error(error);
    };
    
    const showInfo = (info: string) => {
      toast.info(info);
    };
    
    // Check if there's content for formatting actions
    const hasSelection = selection && (selection.text || selection.characterFormat);
    const hasParagraph = selection && selection.paragraphFormat;
    
    switch (action) {
      case 'undo':
        if (editor.editorHistory?.canUndo()) {
          editor.editorHistory.undo();
          showActionFeedback('↶ Undo');
        } else {
          showInfo('Nothing to undo');
        }
        break;
      case 'redo':
        if (editor.editorHistory?.canRedo()) {
          editor.editorHistory.redo();
          showActionFeedback('↷ Redo');
        } else {
          showInfo('Nothing to redo');
        }
        break;
      case 'bold':
        if (hasSelection) {
          const isBold = selection.characterFormat.bold;
          selection.characterFormat.bold = !isBold;
          showActionFeedback(isBold ? 'Bold removed' : 'Bold applied');
        } else {
          showInfo('Select text to apply bold formatting');
        }
        break;
      case 'italic':
        if (hasSelection) {
          const isItalic = selection.characterFormat.italic;
          selection.characterFormat.italic = !isItalic;
          showActionFeedback(isItalic ? 'Italic removed' : 'Italic applied');
        } else {
          showInfo('Select text to apply italic formatting');
        }
        break;
      case 'underline':
        if (hasSelection) {
          const isUnderlined = selection.characterFormat.underline === 'Single';
          selection.characterFormat.underline = isUnderlined ? 'None' : 'Single';
          showActionFeedback(isUnderlined ? 'Underline removed' : 'Underline applied');
        } else {
          showInfo('Select text to apply underline formatting');
        }
        break;
      case 'strikethrough':
        if (hasSelection) {
          const isStrikethrough = selection.characterFormat.strikethrough === 'SingleStrike';
          selection.characterFormat.strikethrough = isStrikethrough ? 'None' : 'SingleStrike';
          showActionFeedback(isStrikethrough ? 'Strikethrough removed' : 'Strikethrough applied');
        } else {
          showInfo('Select text to apply strikethrough formatting');
        }
        break;
      case 'subscript':
        if (hasSelection) {
          const isSubscript = selection.characterFormat.baselineAlignment === 'Subscript';
          selection.characterFormat.baselineAlignment = isSubscript ? 'Normal' : 'Subscript';
          showActionFeedback(isSubscript ? 'Subscript removed' : 'Subscript applied');
        } else {
          showInfo('Select text to apply subscript formatting');
        }
        break;
      case 'superscript':
        if (hasSelection) {
          const isSuperscript = selection.characterFormat.baselineAlignment === 'Superscript';
          selection.characterFormat.baselineAlignment = isSuperscript ? 'Normal' : 'Superscript';
          showActionFeedback(isSuperscript ? 'Superscript removed' : 'Superscript applied');
        } else {
          showInfo('Select text to apply superscript formatting');
        }
        break;
      case 'h1':
        if (hasParagraph) {
          selection.paragraphFormat.styleName = 'Heading 1';
          showActionFeedback('Heading 1 applied');
        } else {
          showInfo('Place cursor in text to apply heading');
        }
        break;
      case 'h2':
        if (hasParagraph) {
          selection.paragraphFormat.styleName = 'Heading 2';
          showActionFeedback('Heading 2 applied');
        } else {
          showInfo('Place cursor in text to apply heading');
        }
        break;
      case 'h3':
        if (hasParagraph) {
          selection.paragraphFormat.styleName = 'Heading 3';
          showActionFeedback('Heading 3 applied');
        } else {
          showInfo('Place cursor in text to apply heading');
        }
        break;
      case 'alignLeft':
        if (hasParagraph) {
          selection.paragraphFormat.textAlignment = 'Left';
          showActionFeedback('Left aligned');
        } else {
          showInfo('Place cursor in text to apply alignment');
        }
        break;
      case 'alignCenter':
        if (hasParagraph) {
          selection.paragraphFormat.textAlignment = 'Center';
          showActionFeedback('Center aligned');
        } else {
          showInfo('Place cursor in text to apply alignment');
        }
        break;
      case 'alignRight':
        if (hasParagraph) {
          selection.paragraphFormat.textAlignment = 'Right';
          showActionFeedback('Right aligned');
        } else {
          showInfo('Place cursor in text to apply alignment');
        }
        break;
      case 'alignJustify':
        if (hasParagraph) {
          selection.paragraphFormat.textAlignment = 'Justify';
          showActionFeedback('Justified');
        } else {
          showInfo('Place cursor in text to apply alignment');
        }
        break;
      case 'orderedList':
        if (hasParagraph) {
          editorModule?.applyNumbering('%1.');
          showActionFeedback('Numbered list applied');
        } else {
          showInfo('Place cursor in text to apply list formatting');
        }
        break;
      case 'unorderedList':
        if (hasParagraph) {
          editorModule?.applyBullet('•', 'Symbol');
          showActionFeedback('Bullet list applied');
        } else {
          showInfo('Place cursor in text to apply list formatting');
        }
        break;
      case 'horizontalRule':
        editorModule?.insertText('\n' + '─'.repeat(50) + '\n');
        showActionFeedback('Horizontal line inserted');
        break;
      case 'link':
        const url = window.prompt('Enter URL:', 'https://');
        if (url && url.trim() && url !== 'https://') {
          const text = selection?.text || url;
          try {
            editorModule?.insertHyperlink(url.trim(), text);
            showActionFeedback('🔗 Link inserted');
          } catch (error) {
            showError('Failed to insert link');
          }
        } else if (url === null) {
          // User cancelled, do nothing
        } else {
          showError('Please enter a valid URL');
        }
        break;
      case 'image':
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e: Event) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            // Validate file size
            if (file.size > 5 * 1024 * 1024) {
              showError('Image size must be less than 5MB');
              return;
            }
            
            // Validate file type
            if (!file.type.startsWith('image/')) {
              showError('Please select a valid image file');
              return;
            }
            
            const reader = new FileReader();
            reader.onload = () => {
              try {
                const base64 = reader.result as string;
                editor.editor?.insertImage(base64, 400, 300);
                showActionFeedback('🖼️ Image inserted');
              } catch (error) {
                showError('Failed to insert image');
              }
            };
            reader.onerror = () => showError('Failed to read image file');
            reader.readAsDataURL(file);
          }
        };
        input.click();
        break;
      case 'imagePosition':
        if (value && editor.selection) {
          try {
            // Apply positioning based on the value using paragraph alignment
            // This works for basic positioning of images within paragraphs
            switch (value) {
              case 'left':
                editor.selection.paragraphFormat.textAlignment = 'Left';
                showActionFeedback('Image aligned left');
                break;
              case 'center':
                editor.selection.paragraphFormat.textAlignment = 'Center';
                showActionFeedback('Image aligned center');
                break;
              case 'right':
                editor.selection.paragraphFormat.textAlignment = 'Right';
                showActionFeedback('Image aligned right');
                break;
              case 'inline':
                // For inline, we set left alignment which typically makes images inline
                editor.selection.paragraphFormat.textAlignment = 'Left';
                showActionFeedback('Image set to inline');
                break;
              case 'top':
                // Top alignment - use center alignment as approximation
                editor.selection.paragraphFormat.textAlignment = 'Center';
                showActionFeedback('Image aligned to top');
                break;
              case 'bottom':
                // Bottom alignment - use center alignment as approximation
                editor.selection.paragraphFormat.textAlignment = 'Center';
                showActionFeedback('Image aligned to bottom');
                break;
              case 'behind':
                // Behind text - use center alignment as approximation
                editor.selection.paragraphFormat.textAlignment = 'Center';
                showActionFeedback('Image placed behind text');
                break;
              case 'front':
                // In front of text - use center alignment as approximation
                editor.selection.paragraphFormat.textAlignment = 'Center';
                showActionFeedback('Image placed in front of text');
                break;
              default:
                showError('Invalid image position');
            }
          } catch (error) {
            showError('Failed to position image. Please make sure an image is selected.');
          }
        } else {
          showInfo('Please select an image first');
        }
        break;
      case 'table':
        const rows = window.prompt('Number of rows (1-20):', '3');
        const columns = window.prompt('Number of columns (1-20):', '3');
        if (rows && columns) {
          const rowCount = parseInt(rows);
          const colCount = parseInt(columns);
          if (!isNaN(rowCount) && !isNaN(colCount) && rowCount > 0 && colCount > 0 && rowCount <= 20 && colCount <= 20) {
            try {
              editorModule?.insertTable(rowCount, colCount);
              showActionFeedback(`📊 Table ${rowCount}×${colCount} inserted`);
            } catch (error) {
              showError('Failed to insert table');
            }
          } else {
            showError('Please enter valid numbers (1-20) for rows and columns');
          }
        }
        break;
      case 'insertRow':
        try {
          editor.editor.insertRow();
          showActionFeedback('➕ Row inserted');
        } catch {
          showError('Please place cursor in a table first');
        }
        break;
      case 'insertColumn':
        try {
          editor.editor.insertColumn();
          showActionFeedback('➕ Column inserted');
        } catch {
          showError('Please place cursor in a table first');
        }
        break;
      case 'deleteRow':
        try {
          editor.editor.deleteRow();
          showActionFeedback('🗑️ Row deleted');
        } catch {
          showError('Please place cursor in a table first');
        }
        break;
      case 'deleteColumn':
        try {
          editor.editor.deleteColumn();
          showActionFeedback('🗑️ Column deleted');
        } catch {
          showError('Please place cursor in a table first');
        }
        break;
      case 'comment':
        if (hasSelection && selection?.text) {
          try {
            editorRef.current?.documentEditor?.editor?.insertComment('');
            showActionFeedback('💬 Comment added');
          } catch {
            showError('Failed to add comment');
          }
        } else {
          showInfo('Select text to add a comment');
        }
        break;
      case 'highlight':
        if (hasSelection) {
          const isHighlighted = selection.characterFormat.highlightColor === 'Yellow';
          selection.characterFormat.highlightColor = isHighlighted ? 'NoColor' : 'Yellow';
          showActionFeedback(isHighlighted ? 'Highlight removed' : '🖍️ Highlight applied');
        } else {
          showInfo('Select text to apply highlight');
        }
        break;
      case 'fontFamily':
        if (value && hasSelection) {
          selection.characterFormat.fontFamily = value;
          setSelectedFont(value);
          showActionFeedback(`Font: ${value}`);
        } else if (!value) {
          showError('Please select a font');
        } else {
          showInfo('Select text to change font');
        }
        break;
      case 'fontSize':
        if (value && hasSelection) {
          const size = parseFloat(value);
          if (size > 0 && size <= 72) {
            selection.characterFormat.fontSize = size;
            setSelectedFontSize(value);
            showActionFeedback(`Size: ${value}`);
          } else {
            showError('Font size must be between 1 and 72');
          }
        } else if (!value) {
          showError('Please select a font size');
        } else {
          showInfo('Select text to change font size');
        }
        break;
      case 'textColor':
        if (value && hasSelection) {
          // Map color values to Syncfusion HighlightColor enum
          const colorMap: Record<string, string> = {
            '#000000': 'Black',
            '#ef4444': 'Red', 
            '#3b82f6': 'Blue',
            '#10b981': 'Green',
            '#f59e0b': 'Yellow',
            '#8b5cf6': 'Violet',
            '#ec4899': 'Pink',
            '#6b7280': 'Gray',
            '#ffff00': 'Yellow'
          };
          const highlightColor = colorMap[value] || 'Black';
          selection.characterFormat.highlightColor = highlightColor as any;
          showActionFeedback('🎨 Text color changed');
        } else if (!value) {
          showError('Please select a color');
        } else {
          showInfo('Select text to change color');
        }
        break;
      case 'quote':
        if (hasParagraph) {
          const isQuoted = selection.paragraphFormat.leftIndent === 36;
          selection.paragraphFormat.leftIndent = isQuoted ? 0 : 36;
          showActionFeedback(isQuoted ? 'Quote removed' : '💭 Quote applied');
        } else {
          showInfo('Place cursor in text to apply quote formatting');
        }
        break;
      case 'code':
        if (hasSelection) {
          const isCode = selection.characterFormat.fontFamily === 'Consolas';
          selection.characterFormat.fontFamily = isCode ? 'Inter' : 'Consolas';
          showActionFeedback(isCode ? 'Code format removed' : '💻 Code format applied');
        } else {
          showInfo('Select text to apply code formatting');
        }
        break;
      case 'margins':
        // For now, show a toast that margins are being set
        showActionFeedback(`📄 Margins: ${value}`);
        showInfo('Margin settings will be applied to the document');
        break;
      case 'lineSpacing':
        if (value && hasParagraph) {
          const spacing = parseFloat(value);
          selection.paragraphFormat.lineSpacing = spacing;
          selection.paragraphFormat.lineSpacingType = 'Multiple';
          showActionFeedback(`📝 Line spacing: ${value}`);
        } else if (!value) {
          showError('Please select line spacing');
        } else {
          showInfo('Place cursor in text to change line spacing');
        }
        break;
      case 'ai-assist':
        // Toggle AI Assistant sidebar
        const aiEvent = new CustomEvent('toggleAIAssistant');
        window.dispatchEvent(aiEvent);
        showActionFeedback('🤖 AI Assistant toggled');
        break;
      case 'settings':
        showInfo('⚙️ Settings panel coming soon!');
        break;
      case 'macros':
        showInfo('🔧 Macros feature coming soon!');
        break;
      default:
        console.log('Action:', action);
        showInfo(`Action "${action}" not yet implemented`);
    }
  }, []);

  // Apply AI content
  const handleApplyAIContent = useCallback((content: string) => {
    if (editorRef.current?.documentEditor) {
      editorRef.current.documentEditor.editor?.insertText(content);
    }
  }, []);

  // Editor ready - enable paste
  const handleEditorReady = useCallback(() => {
    setIsReady(true);
    
    // Set editor in store
    if (editorRef.current) {
      setEditor(editorRef.current);
    }
    
    // Focus the editor to enable paste
    if (editorRef.current?.documentEditor) {
      editorRef.current.documentEditor.focusIn();
    }
  }, [setEditor]);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editorRef.current?.documentEditor) return;
      
      const editor = editorRef.current.documentEditor;
      const isCtrlKey = e.ctrlKey || e.metaKey;
      const isShiftKey = e.shiftKey;
      
      // Prevent default for our shortcuts
      if (isCtrlKey) {
        switch (e.key) {
          case 'b':
            e.preventDefault();
            handleToolbarAction('bold');
            break;
          case 'i':
            e.preventDefault();
            handleToolbarAction('italic');
            break;
          case 'u':
            e.preventDefault();
            handleToolbarAction('underline');
            break;
          case 's':
            e.preventDefault();
            handleSave();
            toast.success('Document saved');
            break;
          case 'z':
            e.preventDefault();
            handleToolbarAction('undo');
            break;
          case 'y':
            e.preventDefault();
            handleToolbarAction('redo');
            break;
          case 'f':
            e.preventDefault();
            toast.info('Find feature coming soon!');
            break;
          case 'p':
            e.preventDefault();
            handleExportDocx();
            break;
        }
      }
      
      // Handle image positioning shortcuts when image is selected
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        handleToolbarAction('imagePosition', 'left');
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        handleToolbarAction('imagePosition', 'right');
      }
      if (e.key === 'ArrowUp' && e.altKey) {
        e.preventDefault();
        handleToolbarAction('imagePosition', 'top');
      }
      if (e.key === 'ArrowDown' && e.altKey) {
        e.preventDefault();
        handleToolbarAction('imagePosition', 'bottom');
      }
      if (e.key === 'c' && e.altKey) {
        e.preventDefault();
        handleToolbarAction('imagePosition', 'center');
      }
      
      // Handle other shortcuts
      if (e.key === 'Tab') {
        e.preventDefault();
        // Insert tab character or handle list indentation
        editor.editor?.insertText('\t');
      }
      
      if (e.key === 'Enter' && isShiftKey) {
        e.preventDefault();
        // Soft line break
        editor.editor?.insertText('\n');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleToolbarAction, handleSave, handleExportDocx]);

  // Handle paste from clipboard with better formatting
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!editorRef.current?.documentEditor) return;
      
      const editor = editorRef.current.documentEditor;
      const clipboardData = e.clipboardData;
      
      if (clipboardData) {
        // Check for HTML content first
        const html = clipboardData.getData('text/html');
        const text = clipboardData.getData('text/plain');
        
        if (text) {
          // Let Syncfusion handle the paste if editor is focused
          if (document.activeElement?.closest('#documentEditor')) {
            return; // Let Syncfusion handle it
          }
          
          e.preventDefault();
          editor.editor?.insertText(text);
          toast.success('Content pasted');
        }
      }
    };

    // Handle AI content application
    const handleApplyToDocument = (event: Event) => {
      const customEvent = event as CustomEvent<{ content: string }>;
      const content = customEvent.detail?.content;
      if (content && editorRef.current?.documentEditor) {
        editorRef.current.documentEditor.editor?.insertText(content);
        toast.success('AI content applied');
      }
    };

    document.addEventListener('paste', handlePaste);
    window.addEventListener('applyToDocument', handleApplyToDocument);
    return () => {
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('applyToDocument', handleApplyToDocument);
    };
  }, []);

  // On mobile, show only the AI Chat interface
  if (isMobile) {
    return <MobileAIChat />;
  }

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      {/* Top Toolbar */}
      <div className="flex-shrink-0">
        <Topbar />
      </div>

      {/* Main Content Area with Sidebars attached to topbar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left Sidebar - Full height attached to topbar */}
        <div className="flex flex-col">
          <SidebarLeft />
        </div>

        {/* Center Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Ribbon Toolbar - Between sidebars */}
          <div className={`flex-shrink-0 border-b transition-colors ${
            theme === 'dark' ? 'bg-background border-border' : 'bg-background border-border'
          }`}>
            <MainToolbar 
              onAction={handleToolbarAction} 
              activeFormats={activeFormats}
              selectedFont={selectedFont}
              selectedFontSize={selectedFontSize}
            />
          </div>

          {/* Document Canvas */}
          <div className="flex-1 min-h-0 transition-colors bg-background">
            <div className="h-full w-full flex items-center justify-center p-4">
              <div className={cn(
                "w-full h-full max-w-6xl rounded-lg shadow-xl overflow-hidden transition-colors",
                theme === 'dark' ? 'bg-card' : 'bg-card'
              )}>
                <DocumentEditorContainerComponent
                  ref={editorRef}
                  id="documentEditor"
                  style={{ display: 'block', height: '100%', direction: 'ltr' }}
                  enableToolbar={false}
                  showPropertiesPane={false}
                  enableLocalPaste={true}
                  enableSpellCheck={false}
                  enableComment={true}
                  enableTrackChanges={false}
                  created={handleEditorReady}
                  contentChange={handleContentChange}
                />
              </div>
            </div>
          </div>

          {/* Status Bar */}
          <StatusBar
            currentPage={currentPage}
            totalPages={totalPages}
            wordCount={wordCount}
            characterCount={characterCount}
            documentName={documentName}
            isSaved={isSaved}
            isTyping={isTyping}
            isAutoSaving={isAutoSaving}
            lastSaved={lastSaved}
          />
        </div>

        {/* Right Sidebar - Full height attached to topbar */}
        <div className="flex flex-col">
          <SidebarRight />
        </div>
      </div>
    </div>
  );
};

export default DocumentEditor;
