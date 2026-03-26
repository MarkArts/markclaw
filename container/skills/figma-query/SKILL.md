---
name: figma-query
version: 0.1.0
description: Query Figma designs, extract design context, and find designs linked to architecture entities. Use when helping users access Figma designs, extract UI specs, or find designs for a project/ADR/FRD.
---

# Figma Design Query

## When to Use

Use this skill when you need to:

- Extract design context (layout, components, styles) from a Figma frame
- Take screenshots of Figma designs
- Get design variables (colors, spacing, typography)
- Find Figma designs linked to a project, ADR, or FRD
- Generate code from Figma designs
- Work with FigJam diagrams
- Set up Code Connect mappings between Figma and code

## How to Invoke

The Figma MCP server provides tools directly. Use them by name:

### Get Design Context (most common)
Extract layout and component info from a Figma frame. Provide a Figma URL:
```
get_design_context(url: "https://www.figma.com/design/FILE_ID/Name?node-id=NODE_ID")
```

### Take a Screenshot
Capture a visual screenshot of a Figma selection:
```
get_screenshot(url: "https://www.figma.com/design/FILE_ID/Name?node-id=NODE_ID")
```

### Get Design Variables
Extract design tokens (colors, spacing, typography) from a selection:
```
get_variable_defs(url: "https://www.figma.com/design/FILE_ID/Name?node-id=NODE_ID")
```

### Get Metadata
Get lightweight XML representation of layer structure (IDs, names, positions, sizes):
```
get_metadata(url: "https://www.figma.com/design/FILE_ID/Name?node-id=NODE_ID")
```

### Work with FigJam
Convert FigJam boards to structured XML:
```
get_figjam(url: "https://www.figma.com/board/FILE_ID/Name?node-id=NODE_ID")
```

### Generate FigJam Diagrams
Create diagrams from Mermaid syntax (flowcharts, sequence diagrams, etc.):
```
generate_diagram(mermaid: "graph TD; A-->B; B-->C")
```

### Code Connect
Map Figma components to code components:
```
get_code_connect_map(url: "...")
get_code_connect_suggestions(url: "...")
add_code_connect_map(url: "...", component: "...", code: "...")
send_code_connect_mappings(mappings: [...])
```

### Create Design System Rules
Generate rule files for design-to-code translation:
```
create_design_system_rules(url: "...")
```

### Check Authentication
```
whoami()
```

## Finding Designs for Architecture Entities

Projects, ADRs, FRDs, and PRDs can have linked Figma designs via `figmaDesigns` in their metadata. To find designs for an entity:

1. Query the entity via Atlas MCP or CLI:
```bash
bun run atlas query:arch:entity --id=<entity-id>
```

2. Look for `figmaDesigns` in the metadata — each entry has:
   - `url` — the Figma frame URL (pass this to Figma MCP tools)
   - `label` — what the design represents
   - `type` — wireframe, mockup, component, flow, prototype, or system-diagram

3. Use the URL with Figma MCP tools:
```
get_design_context(url: "<figmaDesigns[0].url>")
```

## Authentication

Figma MCP uses OAuth — authentication is handled via browser flow on first use. No API tokens or environment variables needed.

## Common Workflows

### Design-to-Code for a Project
1. Find the project's Figma designs: `atlas query:arch:entity --id=project-id`
2. Extract design context: `get_design_context(url: "...")`
3. Get variables for theming: `get_variable_defs(url: "...")`
4. Generate code informed by the design context

### Review ADR Visual Impact
1. Find ADR's linked designs: `atlas query:arch:entity --id=adr-0044`
2. Screenshot the current state: `get_screenshot(url: "...")`
3. Compare with implementation
