import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

  describe('送信の失敗', () => {
    const typeAndSend = (text: string) => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      fireEvent.change(textarea, { target: { value: text } });
      fireEvent.click(screen.getByRole('button', { name: '送信' }));
      return textarea;
    };

    it('送信が失敗すると、入力内容が戻り、エラーメッセージが表示される', async () => {
      const onSend = vi.fn().mockRejectedValue(new Error('メッセージの送信頻度が高すぎます。'));
      render(<MessageInput onSend={onSend} />);

      const textarea = typeAndSend('keep me');

      expect(await screen.findByRole('alert')).toHaveTextContent('メッセージの送信頻度が高すぎます。');
      expect(textarea.value).toBe('keep me');
    });

    it('送信が成功すると、エラーは表示されない', async () => {
      const onSend = vi.fn().mockResolvedValue(undefined);
      render(<MessageInput onSend={onSend} />);

      const textarea = typeAndSend('ok');

      await waitFor(() => expect(onSend).toHaveBeenCalled());
      expect(screen.queryByRole('alert')).toBeNull();
      expect(textarea.value).toBe('');
    });

    it('失敗している間に新しく打ち始めていたら、その入力を上書きしない', async () => {
      let reject!: (e: Error) => void;
      const onSend = vi.fn().mockReturnValue(new Promise<void>((_, r) => { reject = r; }));
      render(<MessageInput onSend={onSend} />);

      const textarea = typeAndSend('first');
      fireEvent.change(textarea, { target: { value: 'second' } });
      reject(new Error('失敗'));

      expect(await screen.findByRole('alert')).toHaveTextContent('失敗');
      expect(textarea.value).toBe('second');
    });

    it('エラー表示は、次に送信するときに消える', async () => {
      const onSend = vi.fn().mockRejectedValueOnce(new Error('失敗')).mockResolvedValue(undefined);
      render(<MessageInput onSend={onSend} />);

      typeAndSend('retry');
      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: '送信' }));

      await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
      expect(onSend).toHaveBeenCalledTimes(2);
    });
  });
});
