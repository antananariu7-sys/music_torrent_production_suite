// Jest globals are available without import
import { render, screen, act, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import ProjectLauncher from './index'
import { ChakraProvider } from '@chakra-ui/react'
import { system } from '../../theme'
import { useProjectStore } from '@/store/useProjectStore'
import type { AppInfo } from '@shared/types/app.types'
import type { RecentProject } from '@shared/types/project.types'

// Mock window.api
const mockSelectDirectory = jest.fn()
const mockGetRecentProjects = jest.fn().mockResolvedValue([])
const mockCreateProject = jest.fn()
const mockOpenProject = jest.fn()
global.window.api = {
  selectDirectory: mockSelectDirectory,
  getRecentProjects: mockGetRecentProjects,
  createProject: mockCreateProject,
  openProject: mockOpenProject,
} as any

// Wrapper for Chakra UI and Router
const TestWrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter
    future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true,
    }}
  >
    <ChakraProvider value={system}>{children}</ChakraProvider>
  </MemoryRouter>
)

const mockAppInfo: AppInfo = {
  name: 'test-app',
  version: '2.0.0',
  platform: 'win32',
  arch: 'x64',
}

const mockRecentProjects: RecentProject[] = [
  {
    projectId: 'project-1',
    projectName: 'Test Project 1',
    projectDirectory: 'C:\\Projects\\test1',
    lastOpened: new Date('2026-02-01'),
    songCount: 5,
  },
  {
    projectId: 'project-2',
    projectName: 'Test Project 2',
    projectDirectory: 'C:\\Projects\\test2',
    lastOpened: new Date('2026-01-20'),
    songCount: 0,
  },
]

describe('ProjectLauncher', () => {
  beforeEach(() => {
    // Reset store and mocks before each test
    act(() => {
      useProjectStore.setState({
        currentProject: null,
        recentProjects: [],
        isLoading: false,
        error: null,
        loadRecentProjects: jest.fn(),
        createProject: jest.fn(),
        openProject: jest.fn(),
        clearError: jest.fn(),
      })
    })
    mockSelectDirectory.mockClear()
    mockGetRecentProjects.mockClear()
    mockGetRecentProjects.mockResolvedValue([])
    mockCreateProject.mockClear()
    mockOpenProject.mockClear()
  })

  describe('Header Section', () => {
    it('should render the system text', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-text-system')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-text-system')).toHaveTextContent(
        '// PROJECT SYSTEM'
      )
    })

    it('should render the main heading', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-heading-main')).toBeInTheDocument()
    })

    it('should render the description text', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.getByTestId('launcher-text-description')
      ).toBeInTheDocument()
      expect(screen.getByTestId('launcher-text-description')).toHaveTextContent(
        'Create a new project or continue working on an existing one'
      )
    })
  })

  describe('Loading State', () => {
    it('should display loading spinner when isLoading is true', () => {
      act(() => {
        useProjectStore.setState({ isLoading: true })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-section-loading')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-text-loading')).toHaveTextContent(
        'LOADING PROJECTS...'
      )
    })

    it('should not display action cards when loading', () => {
      act(() => {
        useProjectStore.setState({ isLoading: true })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.queryByTestId('launcher-card-create')
      ).not.toBeInTheDocument()
      expect(screen.queryByTestId('launcher-card-open')).not.toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('should display error message when error exists', () => {
      act(() => {
        useProjectStore.setState({ error: 'Failed to load project' })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-error-box')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-text-error')).toHaveTextContent(
        'Failed to load project'
      )
    })

    it('should clear error when close button is clicked', async () => {
      const user = userEvent.setup()
      const mockClearError = jest.fn()

      act(() => {
        useProjectStore.setState({
          error: 'Test error',
          clearError: mockClearError,
        })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const closeButton = screen.getByTestId('launcher-button-close-error')
      await user.click(closeButton)

      expect(mockClearError).toHaveBeenCalled()
    })

    it('should not display error box when error is null', () => {
      act(() => {
        useProjectStore.setState({ error: null })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.queryByTestId('launcher-error-box')).not.toBeInTheDocument()
    })
  })

  describe('Create New Project Card', () => {
    it('should render the create project card', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-card-create')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-heading-create')).toHaveTextContent(
        'Create New Project'
      )
      expect(
        screen.getByTestId('launcher-text-create-description')
      ).toBeInTheDocument()
    })

    it('should show create button initially', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-button-create')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-button-create')).toHaveTextContent(
        'New Project'
      )
    })

    it('should show form when create button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      expect(
        screen.getByTestId('launcher-input-project-name')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('launcher-textarea-project-description')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('launcher-input-project-location')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('launcher-button-browse-location')
      ).toBeInTheDocument()
      expect(screen.getByTestId('launcher-button-cancel')).toBeInTheDocument()
      expect(
        screen.getByTestId('launcher-button-submit-create')
      ).toBeInTheDocument()
    })

    it('should update project name when typing', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const nameInput = screen.getByTestId('launcher-input-project-name')
      await user.type(nameInput, 'My Test Project')

      expect(nameInput).toHaveValue('My Test Project')
    })

    it('should update project description when typing', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const descriptionTextarea = screen.getByTestId(
        'launcher-textarea-project-description'
      )
      await user.type(descriptionTextarea, 'Test description')

      expect(descriptionTextarea).toHaveValue('Test description')
    })

    it('should open directory dialog when browse button is clicked', async () => {
      const user = userEvent.setup()
      mockSelectDirectory.mockResolvedValue('C:\\TestFolder')

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const browseButton = screen.getByTestId('launcher-button-browse-location')
      await user.click(browseButton)

      await waitFor(() => {
        expect(mockSelectDirectory).toHaveBeenCalled()
      })
    })

    it('should have submit button disabled when form is incomplete', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const submitButton = screen.getByTestId('launcher-button-submit-create')
      expect(submitButton).toBeDisabled()
    })

    it('should enable submit button when name and location are provided', async () => {
      const user = userEvent.setup()
      mockSelectDirectory.mockResolvedValue('C:\\TestFolder')

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const nameInput = screen.getByTestId('launcher-input-project-name')
      await user.type(nameInput, 'Test Project')

      const browseButton = screen.getByTestId('launcher-button-browse-location')
      await user.click(browseButton)

      await waitFor(() => {
        const submitButton = screen.getByTestId('launcher-button-submit-create')
        expect(submitButton).not.toBeDisabled()
      })
    })

    it('should call createProject when submit button is clicked', async () => {
      const user = userEvent.setup()
      const mockCreateProject = jest.fn()
      mockSelectDirectory.mockResolvedValue('C:\\TestFolder')

      act(() => {
        useProjectStore.setState({ createProject: mockCreateProject })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const nameInput = screen.getByTestId('launcher-input-project-name')
      await user.type(nameInput, 'Test Project')

      const browseButton = screen.getByTestId('launcher-button-browse-location')
      await user.click(browseButton)

      await waitFor(async () => {
        const submitButton = screen.getByTestId('launcher-button-submit-create')
        await user.click(submitButton)

        expect(mockCreateProject).toHaveBeenCalledWith(
          'Test Project',
          'C:\\TestFolder',
          undefined
        )
      })
    })

    it('should hide form when cancel button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const createButton = screen.getByTestId('launcher-button-create')
      await user.click(createButton)

      const cancelButton = screen.getByTestId('launcher-button-cancel')
      await user.click(cancelButton)

      expect(
        screen.queryByTestId('launcher-input-project-name')
      ).not.toBeInTheDocument()
      expect(screen.getByTestId('launcher-button-create')).toBeInTheDocument()
    })
  })

  describe('Open Existing Project Card', () => {
    it('should render the open existing card', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-card-open')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-heading-open')).toHaveTextContent(
        'Open Existing'
      )
      expect(
        screen.getByTestId('launcher-text-open-description')
      ).toBeInTheDocument()
    })

    it('should render the browse button', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-button-browse')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-button-browse')).toHaveTextContent(
        'Browse'
      )
    })

    it('should call openProject when browse button is clicked', async () => {
      const user = userEvent.setup()
      const mockOpenProject = jest.fn()
      mockSelectDirectory.mockResolvedValue('C:\\ExistingProject')

      act(() => {
        useProjectStore.setState({ openProject: mockOpenProject })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const browseButton = screen.getByTestId('launcher-button-browse')
      await user.click(browseButton)

      await waitFor(() => {
        expect(mockSelectDirectory).toHaveBeenCalled()
        expect(mockOpenProject).toHaveBeenCalledWith(
          'C:\\ExistingProject/project.json'
        )
      })
    })
  })

  describe('Recent Projects Section', () => {
    it('should not render recent section when no recent projects', () => {
      act(() => {
        useProjectStore.setState({ recentProjects: [] })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.queryByTestId('launcher-section-recent')
      ).not.toBeInTheDocument()
    })

    it('should render recent section when recent projects exist', () => {
      act(() => {
        useProjectStore.setState({ recentProjects: mockRecentProjects })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-section-recent')).toBeInTheDocument()
      expect(screen.getByTestId('launcher-heading-recent')).toHaveTextContent(
        'Recent Projects'
      )
    })

    it('should render all recent project cards', () => {
      act(() => {
        useProjectStore.setState({ recentProjects: mockRecentProjects })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.getByTestId('launcher-card-recent-project-1')
      ).toBeInTheDocument()
      expect(
        screen.getByTestId('launcher-card-recent-project-2')
      ).toBeInTheDocument()
    })

    it('should display project names in recent cards', () => {
      act(() => {
        useProjectStore.setState({ recentProjects: mockRecentProjects })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const projectNames = screen.getAllByTestId('launcher-text-project-name')
      expect(projectNames[0]).toHaveTextContent('Test Project 1')
      expect(projectNames[1]).toHaveTextContent('Test Project 2')
    })

    it('should display project directories', () => {
      act(() => {
        useProjectStore.setState({ recentProjects: mockRecentProjects })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const directories = screen.getAllByTestId(
        'launcher-text-project-directory'
      )
      expect(directories[0]).toHaveTextContent('C:\\Projects\\test1')
      expect(directories[1]).toHaveTextContent('C:\\Projects\\test2')
    })

    it('should display song count badge when songs exist', () => {
      act(() => {
        useProjectStore.setState({ recentProjects: mockRecentProjects })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const badges = screen.getAllByTestId('launcher-badge-song-count')
      expect(badges).toHaveLength(1) // Only project-1 has songs
      expect(badges[0]).toHaveTextContent('5')
    })

    it('should call openProject when recent project card is clicked', async () => {
      const user = userEvent.setup()
      const mockOpenProject = jest.fn()

      act(() => {
        useProjectStore.setState({
          recentProjects: mockRecentProjects,
          openProject: mockOpenProject,
        })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      const projectCard = screen.getByTestId('launcher-card-recent-project-1')
      await user.click(projectCard)

      expect(mockOpenProject).toHaveBeenCalledWith(
        'C:\\Projects\\test1/project.json'
      )
    })
  })

  describe('Footer Section', () => {
    it('should not render footer when appInfo is null', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(
        screen.queryByTestId('launcher-footer-info')
      ).not.toBeInTheDocument()
    })

    it('should render footer when appInfo is provided', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-footer-info')).toBeInTheDocument()
    })

    it('should display correct version information', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-text-version')).toHaveTextContent(
        'VERSION 2.0.0'
      )
    })

    it('should display correct platform information', () => {
      render(
        <TestWrapper>
          <ProjectLauncher appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(screen.getByTestId('launcher-text-platform')).toHaveTextContent(
        'WIN32 / X64'
      )
    })
  })

  describe('Layout', () => {
    it('should render without errors', () => {
      const { container } = render(
        <TestWrapper>
          <ProjectLauncher appInfo={mockAppInfo} />
        </TestWrapper>
      )

      expect(container).toBeInTheDocument()
    })

    it('should call loadRecentProjects on mount', () => {
      const mockLoadRecentProjects = jest.fn()

      act(() => {
        useProjectStore.setState({ loadRecentProjects: mockLoadRecentProjects })
      })

      render(
        <TestWrapper>
          <ProjectLauncher appInfo={null} />
        </TestWrapper>
      )

      expect(mockLoadRecentProjects).toHaveBeenCalled()
    })
  })
})
