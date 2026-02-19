hossaasdf

heise
# Item.js Playground

This is a demonstration of the Item.js HTTP system capabilities.

## Features asdfasdf

- **Real-time File Editing**: Edit files directly in your browser
- **Tree Navigation**: Browse through folders and files
- **CRUD Operations**: Create, read, update, and delete files
- **JSON Support**: Work with both text and JSON data
- **CORS Enabled**: Connect from any origin

## Getting Started

1. Start the server: `deno run -A server.js`
2. Open your browser to `http://localhost:3495`
3. Start exploring the file system!

## API Endpoints

- `GET /files/*` - Read files and folders
- `PUT /files/*` - Create or update files
- `DELETE /files/*` - Delete files and folders
- `OPTIONS /files/*` - Get metadata

## File Structure

The playground comes with sample files and folders to demonstrate the system:

```
files/
├── demo.html          # Simple HTML demo
├── README.md          # This file
├── notes.txt          # Sample text file
├── config.json        # Configuration data
├── portfolio.html     # Sample portfolio page
└── projects/          # Project folder
    ├── website/       # Website project files
    └── app/           # Application project files
```

Enjoy exploring Item.js!