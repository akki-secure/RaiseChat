import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import AttachmentPreview from './AttachmentPreview';

describe('AttachmentPreview', () => {
  it('添付がなければ何も表示しない', () => {
    const { container } = render(<AttachmentPreview attachments={[]} onRemove={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('画像はサムネイル、動画はファイル名とサイズを表示する', () => {
    render(
      <AttachmentPreview
        onRemove={vi.fn()}
        attachments={[
          { url: 'https://x/uploads/a.png', file_type: 'image/png', size: 2048, name: 'a.png' },
          { url: 'https://x/uploads/b.mp4', file_type: 'video/mp4', size: 3 * 1024 * 1024, name: 'b.mp4' },
        ]}
      />
    );
    expect(screen.getByRole('img', { name: 'a.png' })).toBeInTheDocument();
    expect(screen.getByText('b.mp4')).toBeInTheDocument();
    expect(screen.getByText('3.0MB')).toBeInTheDocument();
  });

  it('×ボタンで onRemove がインデックス付きで呼ばれる', () => {
    const onRemove = vi.fn();
    render(
      <AttachmentPreview
        onRemove={onRemove}
        attachments={[{ url: 'https://x/uploads/a.png', file_type: 'image/png', size: 1, name: 'a.png' }]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '添付を削除' }));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('アップロード中はステータスを表示する', () => {
    render(<AttachmentPreview attachments={[]} uploading onRemove={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('アップロード中');
  });
});
