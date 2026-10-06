'use client';
import { useState, type InputHTMLAttributes } from 'react';

export function PasswordField({ id, label, className = 'owner-input', ...props }: InputHTMLAttributes<HTMLInputElement> & { id: string; label: string }) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-input-row"><input {...props} id={id} name="password" className={className} type={visible ? 'text' : 'password'} autoComplete="current-password" />
      <button type="button" className="password-toggle" disabled={props.disabled} aria-controls={id} aria-pressed={visible} aria-label={'입력한 비밀번호 ' + (visible ? '숨기기' : '표시')} onClick={() => setVisible(!visible)}>{visible ? '숨김' : '표시'}</button>
    </div>
  </div>;
}
