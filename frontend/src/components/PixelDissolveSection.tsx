'use client';

import React, { useRef, useState, useEffect } from 'react';

interface PixelDissolveSectionProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
}

export function PixelDissolveSection({
  children,
  id,
  className = '',
}: PixelDissolveSectionProps) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={sectionRef}
      id={id}
      style={{
        opacity: isVisible ? 1 : 0.6,
        transform: isVisible ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.98)',
        transition: 'opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1), transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        willChange: 'transform, opacity',
      }}
      className={`relative ${className}`}
    >
      {children}
    </div>
  );
}
