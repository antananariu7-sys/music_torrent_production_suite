export const projectLauncherStyles = `
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
      text-shadow: 0 0 10px var(--chakra-colors-brand-400);
    }
    50% {
      text-shadow: 0 0 20px var(--chakra-colors-brand-400),
        0 0 30px var(--chakra-colors-brand-300);
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

  .project-card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .project-card:hover {
    transform: translateY(-8px) scale(1.02);
    border-color: var(--chakra-colors-brand-400);
    box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3);
  }

  .project-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: linear-gradient(
      90deg,
      var(--chakra-colors-brand-400),
      var(--chakra-colors-brand-600)
    );
    transform: scaleX(0);
    transform-origin: left;
    transition: transform 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .project-card:hover::before {
    transform: scaleX(1);
  }

  .action-card {
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .action-card:hover {
    transform: translateY(-6px);
  }

  .action-card::before {
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

  .action-card-1::before {
    background: linear-gradient(
      90deg,
      var(--chakra-colors-brand-400),
      var(--chakra-colors-brand-600)
    );
  }

  .action-card-1:hover {
    border-color: var(--chakra-colors-brand-400);
    box-shadow: 0 20px 60px rgba(59, 130, 246, 0.3);
  }

  .action-card-1:hover::before {
    transform: scaleX(1);
  }

  .action-card-2::before {
    background: linear-gradient(
      90deg,
      var(--chakra-colors-accent-400),
      var(--chakra-colors-accent-600)
    );
  }

  .action-card-2:hover {
    border-color: var(--chakra-colors-accent-400);
    box-shadow: 0 20px 60px rgba(14, 165, 233, 0.3);
  }

  .action-card-2:hover::before {
    transform: scaleX(1);
  }

  .emoji-icon {
    filter: grayscale(0);
    transition: all 0.3s ease;
  }

  .emoji-icon:hover {
    transform: scale(1.2) rotate(-5deg);
  }

  .header-section {
    animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) forwards;
  }

  .action-section {
    animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.2s backwards;
  }

  .recent-section {
    animation: fade-in-up 0.8s cubic-bezier(0.4, 0, 0.2, 1) 0.4s backwards;
  }

  .version-glow {
    animation: glow-pulse 2s ease-in-out infinite;
  }
`
