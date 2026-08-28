import { createRouter, createRoute, createRootRoute, Outlet } from '@tanstack/react-router'
import RootLayout from './components/layout/RootLayout'
import Landing from './pages/Landing'
import LiveSection from './pages/LiveSection'
import Workspace from './pages/Workspace'
import LearnSection from './pages/LearnSection'
import PlaySection from './pages/PlaySection'
import Canvas from './pages/Canvas'
import Analytics from './pages/Analytics'
import SignIn from './pages/SignIn'
import Home from './pages/Home'
import Library from './pages/Library'
import Projects from './pages/Projects'
import Settings from './pages/Settings'

const rootRoute = createRootRoute({ component: () => <Outlet /> })

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: () => <RootLayout><Outlet /></RootLayout>,
})

const indexRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/', component: Landing })
const homeRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/home', component: Home })
const liveRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/live', component: LiveSection })
const learnRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/learn', component: LearnSection })
const playRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/play', component: PlaySection })
const libraryRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/library', component: Library })
const projectsRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/projects', component: Projects })
const analyticsRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/analytics', component: Analytics })
const settingsRoute = createRoute({ getParentRoute: () => layoutRoute, path: '/settings', component: Settings })
const signInRoute = createRoute({ getParentRoute: () => rootRoute, path: '/signin', component: SignIn })

// Full-screen — NO layout wrapper
const workspaceRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/live/$roomId',
  component: Workspace,
})

const canvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/canvas',
  component: Canvas,
})

const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute, homeRoute, liveRoute, learnRoute, playRoute,
    libraryRoute, projectsRoute, analyticsRoute, settingsRoute,
  ]),
  workspaceRoute,
  canvasRoute,
  signInRoute,
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register { router: typeof router }
}
