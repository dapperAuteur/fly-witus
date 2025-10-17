# Contributing Guidelines
**UAS Pre-Flight Checklist System**

Thank you for considering contributing to the Fly Wit Us UAS Checklist project!

## Code of Conduct

### Our Standards
- Be respectful and inclusive
- Focus on constructive feedback
- Prioritize safety and FAA compliance
- Acknowledge contributions of all sizes

### Unacceptable Behavior
- Harassment or discriminatory language
- Publishing others' private information
- Trolling or inflammatory comments
- Anything else unprofessional

---

## How to Contribute

### Reporting Bugs

**Before submitting:**
1. Check existing issues to avoid duplicates
2. Test on latest version
3. Clear browser cache and retry

**Bug report template:**
```markdown
**Description**: Brief summary of the issue

**Steps to Reproduce**:
1. Go to '...'
2. Click on '...'
3. Observe error

**Expected Behavior**: What should happen

**Actual Behavior**: What actually happened

**Screenshots**: If applicable

**Environment**:
- Browser: [Chrome 120.0]
- OS: [Windows 11]
- Device: [Desktop/Mobile]
```

### Suggesting Features

**Feature request template:**
```markdown
**Problem**: What pain point does this solve?

**Proposed Solution**: How should it work?

**Alternatives Considered**: Other approaches

**Priority**: High/Medium/Low (based on PRD)

**FAA Compliance Impact**: Does this affect regulatory requirements?
```

### Pull Requests

**Process:**
1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with clear commits
4. Write/update tests
5. Update documentation
6. Submit PR with description

**PR Checklist:**
- [ ] Code follows TypeScript best practices
- [ ] All tests pass
- [ ] No console errors or warnings
- [ ] Accessible (WCAG 2.1 AA)
- [ ] Mobile responsive
- [ ] Comments added for complex logic
- [ ] README updated if needed

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Local Setup
```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/uas-checklist.git
cd uas-checklist

# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

---

## Code Standards

### TypeScript
- Strict mode enabled
- No `any` types (use `unknown` or specific types)
- Explicit return types for functions
- Interfaces for all data structures

**Example:**
```typescript
// ✅ Good
interface FlightRecord {
  flightNumber: number;
  takeoffLoc: string;
}

const logFlight = (record: FlightRecord): void => {
  console.log(record);
};

// ❌ Bad
const logFlight = (record: any) => {
  console.log(record);
};
```

### React
- Functional components only (no class components)
- Use TypeScript `React.FC` for component types
- Hooks for state management (useState, useEffect, useMemo)
- Destructure props for readability
- Keep components under 300 lines (split if larger)

**Example:**
```typescript
// ✅ Good
interface ChecklistItemProps {
  item: ChecklistItem;
  checked: boolean;
  onToggle: () => void;
}

const ChecklistItem: React.FC<ChecklistItemProps> = ({ item, checked, onToggle }) => {
  return (
    <label>
      <input type="checkbox" checked={checked} onChange={onToggle} />
      {item.label}
    </label>
  );
};

// ❌ Bad
const ChecklistItem = (props: any) => {
  return <label><input type="checkbox" checked={props.checked} onChange={props.onToggle} />{props.item.label}</label>;
};
```

### Styling (Tailwind CSS)
- Use Tailwind utility classes only
- No custom CSS files
- Responsive design: mobile-first approach
- Consistent spacing: 4px increments (p-4, m-2, gap-6)
- Color palette: gray, sky, lime, fuchsia, red, amber

**Example:**
```typescript
// ✅ Good
<button className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition">
  Save
</button>

// ❌ Bad (custom CSS)
<button style={{ backgroundColor: '#0ea5e9', padding: '8px 16px' }}>
  Save
</button>
```

### Naming Conventions
- **Components**: PascalCase (`ChecklistItem.tsx`)
- **Functions**: camelCase (`handleToggle`)
- **Constants**: UPPER_SNAKE_CASE (`STORAGE_KEY`)
- **Interfaces**: PascalCase with descriptive names (`MissionLog`, `FlightRecord`)
- **Boolean variables**: Prefix with `is`, `has`, `should` (`isChecked`, `hasError`)

### Comments
- JSDoc for all exported functions
- Inline comments for complex logic only
- No obvious comments (`// increment counter` ❌)

**Example:**
```typescript
/**
 * Flattens nested subValues into a single-level object for storage
 * @param subValues - Nested object with item IDs as keys
 * @returns Flattened object with concatenated keys
 */
const flattenSubValues = (subValues: { [key: string]: { [subId: string]: string } }): { [key: string]: string } => {
  const flattened: { [key: string]: string } = {};
  Object.entries(subValues).forEach(([itemId, subFields]) => {
    Object.entries(subFields).forEach(([subId, value]) => {
      flattened[`${itemId}_${subId}`] = value;
    });
  });
  return flattened;
};
```

---

## Testing Requirements

### Unit Tests
- Test all utility functions
- Test component rendering
- Test user interactions (clicks, inputs)
- Minimum 80% code coverage

**Example:**
```typescript
import { render, fireEvent } from '@testing-library/react';
import ChecklistItem from './ChecklistItem';

test('checkbox toggles on click', () => {
  const mockToggle = jest.fn();
  const { getByRole } = render(
    <ChecklistItem 
      item={{ id: 'test', label: 'Test Item', type: 'checkbox' }} 
      checked={false} 
      onToggle={mockToggle} 
    />
  );
  
  const checkbox = getByRole('checkbox');
  fireEvent.click(checkbox);
  
  expect(mockToggle).toHaveBeenCalledTimes(1);
});
```

### Manual Testing Checklist
Before submitting PR:
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile device (or responsive mode)
- [ ] Test offline functionality (disable network)
- [ ] Test with screen reader (VoiceOver/NVDA)
- [ ] Test keyboard navigation (Tab, Enter, Space)
- [ ] Clear localStorage and test fresh start
- [ ] Test with 100+ saved missions (performance)

---

## Accessibility Requirements

All contributions must meet **WCAG 2.1 AA** standards:

### Keyboard Navigation
- All interactive elements reachable via Tab
- Logical tab order
- Visible focus indicators
- Enter/Space activate buttons

### Screen Readers
- Semantic HTML (`<button>`, `<label>`, `<nav>`)
- ARIA labels for icons and complex widgets
- Announce dynamic content changes
- Descriptive link text (no "click here")

### Visual Design
- Color contrast: 4.5:1 for text, 3:1 for UI components
- Text resizable to 200% without loss of functionality
- No information conveyed by color alone
- Minimum touch target: 44x44px

**Testing Tools:**
- [WAVE Browser Extension](https://wave.webaim.org/extension/)
- [axe DevTools](https://www.deque.com/axe/devtools/)
- Chrome Lighthouse audit

---

## Security Guidelines

### Data Handling
- **Never store passwords** in localStorage
- **Never log sensitive data** (pilot names, locations in production builds)
- **Validate all user inputs** (XSS prevention)
- **Sanitize file uploads** (if photo feature added)

### localStorage
- Assume localStorage is **not encrypted**
- Only store data user expects to be local
- Provide clear data export/delete options
- Warn users about browser data clearing

**Example:**
```typescript
// ✅ Good - Safe data
const safeData = {
  aircraftType: "DJI Mavic 3",
  batteryVoltage: "15.2V"
};
localStorage.setItem('mission_data', JSON.stringify(safeData));

// ❌ Bad - Sensitive data
const unsafeData = {
  pilotSSN: "123-45-6789", // Never do this!
  creditCard: "4111-1111-1111-1111"
};
```

### API Keys
- No hardcoded API keys in source code
- Use environment variables (`.env`)
- Never commit `.env` to git (add to `.gitignore`)

---

## Documentation Standards

### Code Documentation
- JSDoc for all public functions
- README updates for new features
- Inline comments for complex algorithms

### User-Facing Documentation
- Update README.md usage section
- Add to FAQ if common question
- Create tutorial for complex features
- Update PRD if feature scope changes

---

## Git Workflow

### Branch Naming
- `feature/feature-name` - New features
- `fix/bug-description` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/component-name` - Code refactoring
- `test/add-unit-tests` - Test additions

### Commit Messages
Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation only
- `style:` Formatting (no code change)
- `refactor:` Code restructuring
- `test:` Adding tests
- `chore:` Maintenance tasks

**Examples:**
```bash
feat: add signature capture to PDF exports

fix: prevent auto-save when offline

docs: update installation instructions for Windows

refactor: extract battery voltage logic to utility function

test: add unit tests for weather API integration
```

### Commit Best Practices
- One logical change per commit
- Write clear, descriptive messages
- Reference issue numbers: `fix: resolve #42 - checkbox not saving`
- Keep commits small and focused

---

## Review Process

### PR Review Criteria
Reviewers will check:
1. **Functionality**: Does it work as intended?
2. **Code Quality**: Follows style guide?
3. **Tests**: Adequate coverage?
4. **Performance**: No unnecessary re-renders?
5. **Accessibility**: WCAG compliant?
6. **Security**: No vulnerabilities?
7. **Documentation**: Updated?

### Response Time
- Initial review: Within 48 hours
- Follow-up reviews: Within 24 hours
- Critical bugs: Within 4 hours

### Feedback Expectations
- Be respectful and constructive
- Explain reasoning behind suggestions
- Approve when all concerns addressed
- Request changes if blocking issues

---

## Feature Priority Guidelines

Refer to [PRD.md](PRD.md) for feature prioritization.

**High Priority** (0-3 months):
- Safety-critical features
- FAA compliance improvements
- Major bug fixes

**Medium Priority** (3-6 months):
- Quality of life improvements
- Performance optimizations
- Minor new features

**Low Priority** (6-12 months):
- Nice-to-have features
- UI polish
- Non-critical enhancements

---

## Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- **MAJOR** (v3.0.0): Breaking changes
- **MINOR** (v2.1.0): New features (backward compatible)
- **PATCH** (v2.0.1): Bug fixes

### Release Checklist
1. All tests pass
2. No open critical bugs
3. Documentation updated
4. Changelog written
5. Version number bumped
6. Git tag created
7. Deployed to production

---

## Communication Channels

### GitHub Issues
- Bug reports and feature requests
- Technical discussions
- Roadmap planning

### GitHub Discussions
- General questions
- Community showcase
- Best practices sharing

### Email
- Security vulnerabilities: security@fly.witus.online
- Partnership inquiries: partnerships@fly.witus.online

---

## Recognition

### Contributors
All contributors will be:
- Listed in CONTRIBUTORS.md
- Credited in release notes
- Mentioned in annual report

### Hall of Fame
Top contributors each quarter recognized for:
- Most commits
- Best bug reports
- Most helpful reviews

---

## Legal

### Licensing
By contributing, you agree that your contributions will be licensed under the MIT License.

### Copyright
You retain copyright of your contributions. By submitting, you grant Fly Wit Us a perpetual, worldwide, non-exclusive license to use your contributions.

### Contributor License Agreement (CLA)
First-time contributors must sign our CLA. A bot will comment on your first PR with instructions.

---

## Questions?

- **General**: Open a [GitHub Discussion](https://github.com/dapperAuteur/fly-witus/discussions)
- **Bugs**: Open a [GitHub Issue](https://github.com/dapperAuteur/fly-witus/issues)
- **Security**: Email a@witus.online
- **Other**: Email support@witus.online

---

**Thank you for contributing to safer UAS operations!**

*Fly Wit Us Team*  
[fly.witus.online](https://i.witus.online/fly-witus-uas-drone-pre-flight-checklist-post-flight-log)