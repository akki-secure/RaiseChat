import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttachMenuButton from './AttachMenuButton';

const openLabel = '添付メニューを開く';

describe('AttachMenuButton', () => {
  it('初期状態ではメニューが閉じている', () => {
    render(<AttachMenuButton onSelect={vi.fn()} />);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('＋をクリックするとメニューが開く', () => {
    render(<AttachMenuButton onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: openLabel }));
    expect(screen.getByRole('menuitem', { name: 'ファイルをアップロード' })).toBeTruthy();
  });

  it('Esc でメニューが閉じる', () => {
    render(<AttachMenuButton onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: openLabel }));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('外側クリックでメニューが閉じる', () => {
    render(<AttachMenuButton onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: openLabel }));
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('メニュー項目を選ぶとメニューが閉じ、ファイル選択で onSelect が呼ばれる', () => {
    const onSelect = vi.fn();
    render(<AttachMenuButton onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: openLabel }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'ファイルをアップロード' }));
    expect(screen.queryByRole('menu')).toBeNull();

    const file = new File(['x'], 'a.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('file-input'), { target: { files: [file] } });
    expect(onSelect).toHaveBeenCalledWith(file);
  });

  it('disabled のとき＋ボタンが無効になる', () => {
    render(<AttachMenuButton onSelect={vi.fn()} disabled />);
    expect((screen.getByRole('button', { name: openLabel }) as HTMLButtonElement).disabled).toBe(true);
  });
});
