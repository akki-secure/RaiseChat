import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MessageInput from './MessageInput';

describe('MessageInput', () => {
  it('テキストを入力して送信ボタンを押すと onSend が呼ばれる', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'hello' } });

    const button = screen.getByRole('button', { name: '送信' });
    fireEvent.click(button);

    expect(onSend).toHaveBeenCalledWith('hello');
  });

  it('Enter キーでは onSend が呼ばれない（改行のみ）', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'enter test' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });

  it('空文字では送信ボタンが無効になり onSend が呼ばれない', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const button = screen.getByRole('button', { name: '送信' });
    expect(button).toBeDisabled();
    fireEvent.click(button);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('送信後に入力欄がクリアされる', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'clear me' } });

    const button = screen.getByRole('button', { name: '送信' });
    fireEvent.click(button);

    expect((textarea as HTMLTextAreaElement).value).toBe('');
  });
});
