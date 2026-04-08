import '@testing-library/jest-dom/vitest';

// jsdom stubs
Element.prototype.scrollIntoView = () => {};
