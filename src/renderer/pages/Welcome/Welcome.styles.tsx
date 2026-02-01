export const welcomeStyles = `
  @keyframes fade-in-up {
    from {
      opacity: 0;
      transform: translateY(30px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes glow-pulse {
    0%, 100% {
      text-shadow: 0 0 10px var(--chakra-colors-accent-400);
    }
    50% {
      text-shadow: 0 0 20px var(--chakra-colors-accent-400),
        0 0 30px var(--chakra-colors-accent-300);
    }
  }

  @keyframes card-entrance {
    from {
      opacity: 0;
      transform: translateY(30px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  @keyframes fade-in {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .settings-icon:hover {
    transform: rotate(90deg);
    background: var(--chakra-colors-brand-500);
    color: white;
  }

  .feature-card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .feature-card:hover {
    transform: translateY(-8px) scale(1.02);
  }

  .feature-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .feature-card:hover::before {
    transform: scaleX(1);
  }

  .feature-card-1:hover {
    border-color: var(--chakra-colors-accent-400);
    box-shadow: 0 20px 60px rgba(14, 165, 233, 0.3);
  }

  .feature-card-1::before {
    background: linear-gradient(
      90deg,
      var(--chakra-colors-accent-400),
      var(--chakra-colors-accent-600)
    );
  }

  .feature-card-2:hover {
    border-color: var(--chakra-colors-brand-400);
    box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3);
  }

  .feature-card-2::before {
    background: linear-gradient(
      90deg,
      var(--chakra-colors-brand-400),
      var(--chakra-colors-brand-600)
    );
  }

  .feature-card-3:hover {
    border-color: var(--chakra-colors-purple-400);
    box-shadow: 0 20px 60px rgba(168, 85, 247, 0.3);
  }

  .feature-card-3::before {
    background: linear-gradient(90deg, #a855f7, #8b5cf6);
  }

  .emoji-icon {
    filter: grayscale(0);
    transition: all 0.3s ease;
  }

  .emoji-icon:hover {
    transform: scale(1.2) rotate(-5deg);
  }

  .hero-left {
    animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .hero-right {
    animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s backwards;
  }

  .card-1 {
    animation: card-entrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.4s backwards;
  }

  .card-2 {
    animation: card-entrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.5s backwards;
  }

  .card-3 {
    animation: card-entrance 0.6s cubic-bezier(0.4, 0, 0.2, 1) 0.6s backwards;
  }

  .footer-fade {
    animation: fade-in 0.6s ease-out 0.8s backwards;
  }

  .version-glow {
    animation: glow-pulse 2s ease-in-out infinite;
  }
`
