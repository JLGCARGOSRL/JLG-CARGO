'use client'

import { useEffect, useRef, useState } from 'react'

type AmountInputProps = {
  value: number
  onValueChange: (value: number) => void
  decimals?: number
  className?: string
  placeholder?: string
  blankWhenZero?: boolean
  ariaLabel?: string
}

function formatted(value: number, decimals: number, blankWhenZero: boolean) {
  if (!Number.isFinite(value) || (blankWhenZero && value === 0)) return ''
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function mask(raw: string, decimals: number) {
  const cleaned = raw.replace(/,/g, '').replace(/[^0-9.]/g, '')
  const dot = cleaned.indexOf('.')
  const integerRaw = dot >= 0 ? cleaned.slice(0, dot) : cleaned
  const decimalRaw = dot >= 0 ? cleaned.slice(dot + 1).replace(/\./g, '').slice(0, decimals) : ''
  const integer = integerRaw.replace(/^0+(?=\d)/, '') || (dot >= 0 ? '0' : '')
  const grouped = integer ? Number(integer).toLocaleString('en-US', { maximumFractionDigits: 0 }) : ''
  const text = dot >= 0 && decimals > 0 ? `${grouped}.${decimalRaw}` : grouped
  const numeric = Number(`${integer || '0'}${dot >= 0 && decimalRaw ? `.${decimalRaw}` : ''}`)
  return { text, numeric: Number.isFinite(numeric) ? numeric : 0 }
}

export default function AmountInput({
  value,
  onValueChange,
  decimals = 2,
  className = '',
  placeholder,
  blankWhenZero = true,
  ariaLabel,
}: AmountInputProps) {
  const focused = useRef(false)
  const [text, setText] = useState(() => formatted(value, decimals, blankWhenZero))

  useEffect(() => {
    if (!focused.current) setText(formatted(value, decimals, blankWhenZero))
  }, [blankWhenZero, decimals, value])

  return (
    <input
      type="text"
      inputMode={decimals === 0 ? 'numeric' : 'decimal'}
      value={text}
      placeholder={placeholder || (decimals > 0 ? '0.00' : '0')}
      aria-label={ariaLabel}
      onFocus={(event) => {
        focused.current = true
        event.currentTarget.select()
      }}
      onChange={(event) => {
        const next = mask(event.target.value, decimals)
        setText(next.text)
        onValueChange(next.numeric)
      }}
      onBlur={() => {
        focused.current = false
        setText(formatted(value, decimals, blankWhenZero))
      }}
      className={className}
    />
  )
}
