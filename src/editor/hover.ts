/**
 * Hover tooltips for CodeMirror 6.
 *
 * Shows contextual information when hovering over:
 * - JS/TS keywords (descriptions)
 * - Global APIs (Web API docs, built-in info)
 * - CSS properties and values
 * - HTML tags and attributes
 * - Syntax tree node info for functions and variables
 *
 * Uses hoverTooltip() from @codemirror/view — no extra packages needed.
 */

import { hoverTooltip } from "@codemirror/view";
import type { EditorView, Tooltip } from "@codemirror/view";

// ─── Helper: escape HTML for safe display ───────────────────
function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── JS/TS Keyword descriptions ─────────────────────────────
const keywordDocs: Record<string, string> = {
  const: "Declares a block-scoped constant. The value cannot be reassigned.",
  let: "Declares a block-scoped variable, optionally initializing it.",
  var: "Declares a function-scoped or global variable.",
  function: "Declares a function with the specified parameters and body.",
  return: "Exits the current function and returns a value.",
  if: "Executes a block of code if a specified condition is true.",
  else: "Executes a block of code if the same condition is false.",
  for: "Creates a loop with optional initialization, condition, and increment.",
  while: "Creates a loop that executes as long as a condition is true.",
  do: "Creates a loop that executes once before checking the condition.",
  switch: "Evaluates an expression and executes matching case clauses.",
  case: "A clause in a switch statement that matches a value.",
  break: "Terminates the current loop or switch statement.",
  continue: "Skips to the next iteration of a loop.",
  new: "Creates an instance of a user-defined object type.",
  this: "Refers to the current execution context's object.",
  super: "Refers to the parent class, used to call parent constructors/methods.",
  typeof: "Returns a string indicating the type of an operand.",
  instanceof: "Checks if an object is an instance of a specific constructor.",
  delete: "Removes a property from an object.",
  void: "Evaluates an expression and returns undefined.",
  throw: "Throws a user-defined exception.",
  try: "Defines a block of code to test for errors.",
  catch: "Defines a block to handle errors from a try block.",
  finally: "Executes after try/catch regardless of the result.",
  async: "Declares an asynchronous function that returns a Promise.",
  await: "Pauses async function execution until a Promise resolves.",
  yield: "Pauses/resumes a generator function.",
  import: "Imports bindings from an external module.",
  export: "Exports bindings for use in other modules.",
  default: "Sets the default export of a module.",
  from: "Specifies the module path in an import statement.",
  of: "Used in for...of loops to iterate over iterable values.",
  class: "Declares a class with constructor and methods.",
  extends: "Creates a class that inherits from another class.",
  implements: "Specifies interfaces a class must implement (TS).",
  interface: "Defines a contract for object shapes (TypeScript).",
  type: "Creates a type alias (TypeScript).",
  enum: "Defines a set of named constants (TypeScript).",
  namespace: "Declares a scope container for related code (TS).",
  static: "Defines a static method or property on a class.",
  private: "Marks a member as private (accessible only within class).",
  public: "Marks a member as public (default visibility).",
  protected: "Marks a member as protected (accessible in subclasses).",
  readonly: "Marks a property as read-only (cannot be reassigned).",
  abstract: "Declares an abstract class or method (must be subclassed).",
  as: "Type assertion in TypeScript.",
  is: "Type guard / type predicate in TypeScript.",
  keyof: "Returns a union of known property names (TypeScript).",
  infer: "Infers a type in conditional types (TypeScript).",
  any: "Opts out of type checking (TypeScript).",
  never: "Represents values that never occur (TypeScript).",
  unknown: "Type-safe counterpart of any (TypeScript).",
  null: "Represents the intentional absence of an object value.",
  undefined: "Represents an uninitialized variable.",
  string: "Represents textual data (primitive type).",
  number: "Represents numeric values (primitive type).",
  boolean: "Represents true/false values (primitive type).",
  symbol: "Represents a unique, immutable identifier.",
  bigint: "Represents integers with arbitrary precision.",
  true: "Boolean literal value.",
  false: "Boolean literal value.",
  declare: "Declares a variable/function without implementation (TS).",
  module: "Declares an external module (TypeScript).",
};

// ─── JS Global API descriptions ─────────────────────────────
const globalDocs: Record<string, string> = {
  console:
    "<span class=cm-hover-tag>Web API</span> Provides access to the browser debugging console.",
  document:
    "<span class=cm-hover-tag>DOM API</span> Represents the web page loaded in the browser.",
  window:
    "<span class=cm-hover-tag>DOM API</span> Represents the browser window containing the document.",
  fetch:
    "<span class=cm-hover-tag>Web API</span> Starts the process of fetching a resource from the network. Returns a Promise.",
  localStorage:
    "<span class=cm-hover-tag>Web API</span> Stores key-value pairs persistently across browser sessions.",
  sessionStorage:
    "<span class=cm-hover-tag>Web API</span> Stores key-value pairs for the current browser session only.",
  setTimeout:
    "<span class=cm-hover-tag>Web API</span> Calls a function after a specified delay (milliseconds).",
  setInterval:
    "<span class=cm-hover-tag>Web API</span> Repeatedly calls a function at specified intervals.",
  clearTimeout:
    "<span class=cm-hover-tag>Web API</span> Cancels a timeout set by setTimeout().",
  clearInterval:
    "<span class=cm-hover-tag>Web API</span> Cancels an interval set by setInterval().",
  JSON: "<span class=cm-hover-tag>Built-in</span> Object for parsing and serializing JSON data.",
  Math: "<span class=cm-hover-tag>Built-in</span> Object with mathematical constants and functions.",
  Array:
    "<span class=cm-hover-tag>Built-in</span> Constructor for array instances. Supports indexed collections.",
  Object:
    "<span class=cm-hover-tag>Built-in</span> Constructor for object instances. The root of all objects.",
  String:
    "<span class=cm-hover-tag>Built-in</span> Constructor for string instances. Represents textual data.",
  Number:
    "<span class=cm-hover-tag>Built-in</span> Constructor for number instances. Represents numeric values.",
  Boolean:
    "<span class=cm-hover-tag>Built-in</span> Constructor for boolean instances.",
  Promise:
    "<span class=cm-hover-tag>Built-in</span> Represents an asynchronous operation that may complete in the future.",
  Map: "<span class=cm-hover-tag>ES6</span> Collection of key-value pairs with insertion order.",
  Set: "<span class=cm-hover-tag>ES6</span> Collection of unique values with insertion order.",
  WeakMap:
    "<span class=cm-hover-tag>ES6</span> Weakly held key-value collection. Keys are objects.",
  WeakSet:
    "<span class=cm-hover-tag>ES6</span> Weakly held collection of objects.",
  Symbol:
    "<span class=cm-hover-tag>Built-in</span> Constructor for unique and immutable identifiers.",
  RegExp:
    "<span class=cm-hover-tag>Built-in</span> Object for matching text with patterns.",
  Error:
    "<span class=cm-hover-tag>Built-in</span> Represents an error condition. Can be thrown.",
  Date: "<span class=cm-hover-tag>Built-in</span> Object for representing dates and times.",
  parseInt:
    "<span class=cm-hover-tag>Global</span> Parses a string and returns an integer.",
  parseFloat:
    "<span class=cm-hover-tag>Global</span> Parses a string and returns a floating-point number.",
  isNaN:
    "<span class=cm-hover-tag>Global</span> Determines whether a value is NaN (not-a-number).",
  isFinite:
    "<span class=cm-hover-tag>Global</span> Determines whether a value is a finite number.",
  NaN: "<span class=cm-hover-tag>Global</span> Represents 'not-a-number'.",
  Infinity: "<span class=cm-hover-tag>Global</span> Represents positive infinity.",
};

// ─── CSS property descriptions ──────────────────────────────
const cssDocs: Record<string, string> = {
  display: "Defines the display behavior of an element (flex, grid, block, etc.).",
  position: "Sets the positioning method for an element.",
  margin: "Sets the outer space around an element (shorthand).",
  padding: "Sets the inner space within an element (shorthand).",
  color: "Sets the text color of an element.",
  background: "Sets background properties (shorthand).",
  "background-color": "Sets the background color of an element.",
  "font-size": "Sets the size of the font.",
  "font-weight": "Sets the weight (boldness) of the font.",
  "font-family": "Specifies the font(s) for an element.",
  width: "Sets the width of an element.",
  height: "Sets the height of an element.",
  border: "Sets border properties (shorthand).",
  "border-radius": "Rounds the corners of an element's border.",
  "box-shadow": "Attaches one or more shadows to an element's box.",
  opacity: "Sets the transparency level of an element.",
  overflow: "Controls what happens to content that overflows its box.",
  cursor: "Sets the mouse cursor style when hovering over an element.",
  "z-index": "Sets the stack order of a positioned element.",
  transform: "Applies a 2D or 3D transformation to an element.",
  transition: "Defines smooth transitions between property changes.",
  animation: "Applies keyframe animations to an element.",
  flex: "Shorthand for flex-grow, flex-shrink, flex-basis.",
  "flex-direction": "Sets the direction of flex items (row, column).",
  "flex-wrap": "Controls whether flex items wrap to multiple lines.",
  "justify-content": "Aligns flex items along the main axis.",
  "align-items": "Aligns flex items along the cross axis.",
  gap: "Sets the spacing between grid/flex items.",
  grid: "Shorthand for grid-template-rows/columns/areas.",
  "grid-template": "Defines the columns and rows of a grid container.",
  "text-align": "Sets the horizontal alignment of inline content.",
  "text-decoration": "Adds decorative lines to text (underline, etc.).",
  "line-height": "Sets the height of a line of text.",
  visibility: "Shows or hides an element without removing its layout space.",
  float: "Places an element to the left or right of its container.",
  content: "Inserts generated content (used with ::before/::after).",
};

// ─── HTML descriptions ──────────────────────────────────────
const htmlDocs: Record<string, string> = {
  div: "Generic container for flow content. Does not imply any meaning.",
  span: "Generic inline container for phrasing content.",
  p: "Represents a paragraph of text.",
  a: "Creates a hyperlink to other pages or locations.",
  img: "Embeds an image in the document.",
  input: "Creates an interactive form control for user data.",
  button: "Creates a clickable button element.",
  form: "Represents a document section with interactive controls.",
  section: "Represents a standalone section of a document.",
  article: "Represents a self-contained composition in a document.",
  header: "Represents introductory content or navigational aids.",
  footer: "Represents the footer of a section or root element.",
  nav: "Represents a section with navigation links.",
  main: "Represents the dominant content of the document.",
  aside: "Represents content tangentially related to the main content.",
  ul: "Represents an unordered list of items.",
  ol: "Represents an ordered list of items.",
  li: "Represents a list item in ul or ol.",
  table: "Represents tabular data in rows and columns.",
  h1: "Section heading at level 1 (highest importance).",
  h2: "Section heading at level 2.",
  h3: "Section heading at level 3.",
  label: "Provides a label for a form control.",
  select: "Creates a dropdown list of options.",
  textarea: "Creates a multi-line text input control.",
  meta: "Represents metadata that cannot be represented by other elements.",
  link: "Links external resources (CSS, favicon, etc.) to the document.",
  script: "Embeds or references executable JavaScript code.",
  svg: "Container for SVG (Scalable Vector Graphics) content.",
  canvas: "Container for dynamic bitmap graphics (via JavaScript).",
  code: "Displays a fragment of computer code (monospace).",
  pre: "Displays preformatted text (preserves whitespace).",
  br: "Produces a line break in text.",
  hr: "Represents a thematic break (horizontal rule).",
  strong: "Indicates strong importance (usually rendered bold).",
  em: "Indicates emphasized text (usually rendered italic).",
  class: "Attaches one or more class names to an element for styling.",
  id: "Defines a unique identifier for an element.",
  href: "Specifies the URL of a linked resource.",
  src: "Specifies the URL of an embedded resource.",
  alt: "Provides alternative text for an image.",
  title: "Provides advisory information about an element.",
  type: "Specifies the type of an element (e.g., input type, script type).",
  name: "Specifies the name of a form control or element.",
  value: "Specifies the value of an input element.",
  placeholder: "Provides a hint of the expected input value.",
  disabled: "Disables an input element (user cannot interact).",
  required: "Marks a form field as required before submission.",
  checked: "Pre-selects a checkbox or radio button.",
  target: "Specifies where to open a linked document.",
  rel: "Specifies the relationship between linked documents.",
  onclick: "Fires when the element is clicked.",
  onchange: "Fires when the element's value changes.",
  onsubmit: "Fires when a form is submitted.",
};

// ─── Lookup helper — checks dictionaries in priority order ─
function lookupDoc(text: string): { info: string; tag: string } | null {
  if (keywordDocs[text]) return { info: keywordDocs[text], tag: "keyword" };
  if (globalDocs[text]) {
    const tagMatch = globalDocs[text].match(
      /<span class=cm-hover-tag>([^<]+)<\/span>/
    );
    const tag = tagMatch ? tagMatch[1] : "API";
    return { info: globalDocs[text], tag };
  }
  if (cssDocs[text]) return { info: cssDocs[text], tag: "CSS" };
  if (htmlDocs[text]) return { info: htmlDocs[text], tag: "HTML" };
  return null;
}

// ─── Hover tooltip source ───────────────────────────────────
export const hoverPlugin = hoverTooltip(
  (view: EditorView, pos: number, _side: -1 | 1): Tooltip | null => {
    // Get the word at the hover position
    const word = view.state.wordAt(pos);
    if (!word) return null;

    const text = view.state.sliceDoc(word.from, word.to);
    if (!text || text.length === 0) return null;

    // Look up in documentation dictionaries (priority order)
    const doc = lookupDoc(text);
    if (!doc) return null;

    return {
      pos: word.from,
      end: word.to,
      create() {
        const dom = document.createElement("div");
        dom.className = "cm-hover-info";
        dom.innerHTML = `
          <div class="cm-hover-header">
            <span class="cm-hover-name">${esc(text)}</span>
            <span class="cm-hover-type">${esc(doc.tag)}</span>
          </div>
          <div class="cm-hover-body">${doc.info}</div>
        `;
        return { dom, offset: { x: 0, y: 4 } };
      },
    };
  },
  { hideOnChange: true }
);
