import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { SearchField, SegmentedControl } from '../molecules';
import { Toggle } from '../atoms';

const items = [
  { id: 'NVDA', ticker: 'NVDA', label: 'Nvidia' },
  { id: 'TSM', ticker: 'TSM', label: 'TSMC', keywords: ['Taiwan Semiconductor'] },
  { id: 'MSFT', ticker: 'MSFT', label: 'Microsoft' },
];

describe('SearchField', () => {
  it('ranks ticker matches first and selects with Enter', () => {
    const onSelect = vi.fn();
    render(<SearchField items={items} onSelect={onSelect} hotkey={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'ts' } });
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('TSMC');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('TSM');
  });

  it('matches aliases and supports arrow navigation', () => {
    const onSelect = vi.fn();
    render(<SearchField items={items} onSelect={onSelect} hotkey={false} />);
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'taiwan' } });
    expect(screen.getByRole('option')).toHaveTextContent('TSMC');
    fireEvent.change(input, { target: { value: 'mi' } });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows an empty message', () => {
    render(<SearchField items={items} onSelect={() => {}} hotkey={false} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zzz' } });
    expect(screen.getByText(/No companies match/)).toBeInTheDocument();
  });
});

describe('SegmentedControl', () => {
  function Harness() {
    const [v, setV] = useState<'a' | 'b' | 'c'>('a');
    return <SegmentedControl label="Mode" value={v} onChange={setV} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }]} />;
  }
  it('exposes a radiogroup and moves with arrow keys', () => {
    render(<Harness />);
    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument();
    const a = screen.getByRole('radio', { name: 'A' });
    expect(a).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Toggle', () => {
  it('is a labelled switch', () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Show labels" />);
    const sw = screen.getByRole('switch', { name: 'Show labels' });
    fireEvent.click(sw);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
