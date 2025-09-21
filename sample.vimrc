" Sample .vimrc file for mdlens
" Copy this to ~/.vimrc to customize your Vim experience in mdlens

" Basic settings
set number          " Show line numbers
set wrap            " Enable line wrapping
set tabstop=4       " Set tab width to 4 spaces
set expandtab       " Use spaces instead of tabs
set autoindent      " Enable auto-indentation

" Custom key mappings
" Map jk to escape in insert mode (popular Vim customization)
inoremap jk <Esc>

" Map leader key combinations (if you use a leader key)
" nnoremap <leader>w :w<CR>

" Quick save mapping
nnoremap <C-s> :w<CR>
inoremap <C-s> <Esc>:w<CR>

" Navigation improvements
nnoremap j gj
nnoremap k gk

" Example of more complex mappings
" nnoremap <Space> za    " Use space to toggle folds (if folding was supported)

" Note: mdlens supports the following .vimrc features:
" - Basic set commands (number, wrap, tabstop, expandtab, autoindent)
" - Key mappings (nnoremap, inoremap, vnoremap, nmap, imap, vmap)
" - Comments (lines starting with ")
"
" Some advanced Vim features may not be supported as they depend on
" Vim-specific functionality not available in CodeMirror's Vim mode.
