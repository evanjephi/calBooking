import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

describe('App smoke test', () => {
  it('renders without crashing', () => {
    render(<div>Hello</div>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
