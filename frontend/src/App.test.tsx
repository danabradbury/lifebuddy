import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { App } from './App'

describe('App', () => {
  it('renders auth form when not authenticated', () => {
    // Ensure no stale auth is present
    window.localStorage.removeItem('lifebuddy-auth')

    render(<App />)

    expect(screen.getByText('Lifebuddy')).toBeInTheDocument()
    expect(screen.getByText('Log in')).toBeInTheDocument()
    expect(screen.getByText('Create account')).toBeInTheDocument()
  })

  it('calls auth endpoint on login click when fields are filled', async () => {
    window.localStorage.removeItem('lifebuddy-auth')

    // Mock fetch to avoid hitting real backend
    const fetchMock = vi
      .spyOn(global, 'fetch')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: 'test-token',
          user: { email: 'test@example.com' },
        }),
      } as any)

    render(<App />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'test@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'secret' },
    })

    fireEvent.click(screen.getByText('Log in'))

    expect(fetchMock).toHaveBeenCalledTimes(1)

    fetchMock.mockRestore()
  })
})

