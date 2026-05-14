import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ThemeProvider, useTheme } from '../ThemeContext'

function ThemeConsumer() {
  const { dark, toggle } = useTheme()
  return (
    <div>
      <span data-testid="dark-value">{dark ? 'dark' : 'light'}</span>
      <button onClick={toggle}>Toggle</button>
    </div>
  )
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('renders children inside ThemeProvider', () => {
    render(
      <ThemeProvider>
        <span>child content</span>
      </ThemeProvider>
    )
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('toggles dark class on documentElement', () => {
    // Start in light mode explicitly
    localStorage.setItem('storybook-theme', 'light')

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('dark-value')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    fireEvent.click(screen.getByText('Toggle'))

    expect(screen.getByTestId('dark-value')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('defaults to system preference when no saved theme', () => {
    // Mock matchMedia to prefer dark
    const matchMediaSpy = vi.fn().mockImplementation((query: string) => ({
      matches: query === '(prefers-color-scheme: dark)',
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))
    Object.defineProperty(window, 'matchMedia', { value: matchMediaSpy, writable: true })

    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>
    )

    expect(screen.getByTestId('dark-value')).toHaveTextContent('dark')
  })

  it('throws when useTheme is used outside ThemeProvider', () => {
    // Suppress console.error for the expected error
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<ThemeConsumer />)).toThrow(
      'useTheme must be used within a ThemeProvider'
    )

    consoleSpy.mockRestore()
  })
})
