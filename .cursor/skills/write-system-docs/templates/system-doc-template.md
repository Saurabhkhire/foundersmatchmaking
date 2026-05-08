# System Documentation Template

## 1) Architecture
- High-level overview
- Frontend architecture
- Backend architecture
- Data flow
- Realtime flow
- Security/auth architecture

## 2) Workflows
- Registration workflow
- Login workflow
- Founder workflow
- Investor workflow
- Admin run matching workflow
- Realtime refresh workflow

## 3) Database Structure
- ERD-style table mapping
- Table-by-table fields
- Constraints/indexes
- Relationships
- Notes on pgvector/sqlite differences

## 4) LLM Input/Output and Prompts
For each LLM use case:
- Purpose
- System prompt
- User prompt
- Input payload example
- Output schema
- Fallback behavior

## 5) Technical Flow + File Structure
- Folder tree
- Responsibilities by folder
- File-level responsibility map

## 6) Method I/O Contracts
For each method/function:
- File path
- Method/function name
- Input
- Output
- Side effects
- Error paths

## 7) Test Cases (API + UI)
### API Tests
For each route:
- Positive test cases
- Negative test cases
- Expected status and payload

### UI Tests
For each page/flow:
- Positive tests
- Negative tests
- Expected UX outcomes
