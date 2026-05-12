import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface BaseProps {
  label: string;
  error?: string;
  full?: boolean;
}

type InputProps = BaseProps & InputHTMLAttributes<HTMLInputElement> & { as?: 'input' };
type SelectProps = BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { as: 'select'; children: React.ReactNode };
type TextareaProps = BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement> & { as: 'textarea' };

type FieldProps = InputProps | SelectProps | TextareaProps;

export default function Field({ label, error, full, as = 'input', ...props }: FieldProps) {
  return (
    <div className={`fr${full ? ' full' : ''}`}>
      <label className="lbl">{label}</label>
      {as === 'select' ? (
        <select className={`sel${error ? ' inp-err' : ''}`} {...(props as SelectHTMLAttributes<HTMLSelectElement>)} />
      ) : as === 'textarea' ? (
        <textarea className={`ta${error ? ' inp-err' : ''}`} {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
      ) : (
        <input className={`inp${error ? ' inp-err' : ''}`} {...(props as InputHTMLAttributes<HTMLInputElement>)} />
      )}
      {error && <span style={{ fontSize: 10.5, color: 'var(--R)', marginTop: 2 }}>{error}</span>}
    </div>
  );
}
