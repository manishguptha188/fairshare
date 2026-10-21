import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App.jsx';

// A tiny fake API: each key is "METHOD /path" and the value is the response to send back.
function fakeApi(routes) {
  const fetchMock = vi.fn(async (url, options = {}) => {
    const key = `${options.method ?? 'GET'} ${url}`;
    const route = routes[key];
    if (!route) throw new Error(`Unexpected request: ${key}`);
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers: { 'Content-Type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function renderAt(path) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('sends a logged-out visitor to the login page, then back after logging in', async () => {
    const asha = { id: 'a'.repeat(24), name: 'Asha', email: 'asha@example.com' };
    const fetchMock = fakeApi({
      'GET /api/auth/me': { status: 401, body: { error: 'Please log in to continue.' } },
      'POST /api/auth/login': { body: { user: asha } },
      'GET /api/groups': { body: { groups: [] } },
    });
    renderAt('/groups');

    expect(await screen.findByRole('heading', { name: 'Log in to FairShare' })).toBeInTheDocument();

    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-horse-1');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('heading', { name: 'Your groups' })).toBeInTheDocument();
    expect(await screen.findByText('No groups yet')).toBeInTheDocument();
    expect(screen.getByText('Asha')).toBeInTheDocument();

    const loginCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login');
    expect(JSON.parse(loginCall[1].body)).toEqual({ email: 'asha@example.com', password: 'correct-horse-1' });
  });

  it('shows the error from the server when login fails', async () => {
    fakeApi({
      'GET /api/auth/me': { status: 401, body: { error: 'Please log in to continue.' } },
      'POST /api/auth/login': { status: 401, body: { error: 'Email or password is incorrect.' } },
    });
    renderAt('/login');

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Email'), 'asha@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.');
  });

  it('offers a retry when the group list fails to load', async () => {
    fakeApi({
      'GET /api/auth/me': { body: { user: { id: 'a'.repeat(24), name: 'Asha', email: 'asha@example.com' } } },
      'GET /api/groups': { status: 500, body: { error: 'Something went wrong on our side. Please try again.' } },
    });
    renderAt('/groups');

    expect(await screen.findByText('Something went wrong on our side. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
