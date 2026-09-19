import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserIcon, LoginIcon } from '../icons';

type Tab = 'user' | 'admin';

const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const [tab, setTab] = useState<Tab>('user');
  const [personalNumber, setPersonalNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const switchTab = (newTab: Tab) => {
    setTab(newTab);
    setError(null);
    setPassword('');
  };

  const submit = async (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      await login(
        personalNumber,
        tab === 'admin',
        tab === 'admin' ? password : undefined
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Login fehlgeschlagen. Bitte versuche es erneut.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    void submit(e);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      void submit(e);
    }
  };

  return (
    <div className='glass-card w-full max-w-md p-8 rounded-2xl'>
      <div className='flex justify-center mb-6'>
        <div className='logo-main relative w-[100px] h-[100px]'>
          <span className='logo-text-hp text-[70px] absolute top-[-15px] left-[-5px] z-20'>hp</span>
          <span className='logo-text text-xs absolute bottom-[16px] left-10 z-20'>olytechnik</span>
        </div>
      </div>

      <h2 className='text-2xl font-bold mb-1 text-center text-slate-900'>
        ToolSync
      </h2>
      <p className='text-sm text-slate-500 text-center mb-6'>
        Anmeldung
      </p>

      <div className='ui-tabs mb-6'>
        <button
          type='button'
          onClick={() => switchTab('user')}
          className={tab === 'user' ? 'is-active flex-1' : 'flex-1'}
        >
          <span className='inline-flex items-center justify-center gap-2'>
            <UserIcon className='icon w-4 h-4 text-teal-600' />
            Mitarbeiter
          </span>
        </button>
        <button
          type='button'
          onClick={() => switchTab('admin')}
          className={tab === 'admin' ? 'is-active flex-1' : 'flex-1'}
        >
          <span className='inline-flex items-center justify-center gap-2'>
            <LoginIcon className='icon w-4 h-4 text-teal-600' />
            Admin
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className='space-y-4'>
        <div>
          <input
            id='personalNumber'
            name='personalNumber'
            type='password'
            value={personalNumber}
            onChange={(e) => setPersonalNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Personalnummer'
            required
            autoComplete='off'
            autoCorrect='off'
            autoCapitalize='none'
            spellCheck={false}
            data-lpignore='true'
            data-1p-ignore='true'
            data-form-type='other'
            disabled={isLoading}
            className='input-bordered'
          />
        </div>

        {tab === 'admin' && (
          <div>
            <input
              id='password'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder='Admin-Passwort'
              required
              autoComplete='current-password'
              disabled={isLoading}
              className='input-bordered'
            />
          </div>
        )}

        {error && (
          <div role='alert' className='ui-alert ui-alert-error'>
            <span>×</span>
            <div>{error}</div>
          </div>
        )}

        <button type='submit' disabled={isLoading} className='ui-btn ui-btn-primary w-full'>
          {isLoading ? 'Anmelden...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
};

export default LoginForm;
