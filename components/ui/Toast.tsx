'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useStore } from '@/lib/store'

export function Toast() {
  const toast = useStore((s) => s.toast)
  return (
    <div className="toast-wrap" aria-live="polite">
      <AnimatePresence mode="wait">
        {toast && (
          <motion.div
            key={toast.id}
            className="toast"
            initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
            transition={{ type: 'spring', stiffness: 160, damping: 20 }}
          >
            <span className="toast-main display">{toast.text}</span>
            {toast.sub && <span className="toast-sub label">{toast.sub}</span>}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
