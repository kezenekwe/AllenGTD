import {useState, useEffect, useRef} from 'react';
import {itemRepository} from '@services/database/repositories/ItemRepository';
import {stepsCollection} from '@services/database';
import Item from '@services/database/models/Item';
import ProjectStep from '@services/database/models/ProjectStep';

// ─── useProjectsWithSteps ──────────────────────────────────────────────────
// Special hook for projects that fetches steps eagerly.
// Subscribes to BOTH items and project_steps so edits to steps
// always trigger a re-fetch even when the item record itself doesn't change.

export interface ProjectWithSteps extends Item {
  fetchedSteps?: ProjectStep[];
}

export function useProjectsWithSteps() {
  const [items, setItems] = useState<ProjectWithSteps[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const projectsRef = useRef<Item[]>([]);

  const refreshProjects = async (projects: Item[]) => {
    projectsRef.current = projects;
    const projectsWithSteps = await Promise.all(
      projects.map(async project => {
        try {
          const steps = await project.steps.fetch();
          const sortedSteps = steps.sort((a, b) => a.stepOrder - b.stepOrder);
          const projectWithSteps = project as ProjectWithSteps;
          projectWithSteps.fetchedSteps = sortedSteps;
          return projectWithSteps;
        } catch (error) {
          console.error('Error fetching steps for project:', error);
          const projectWithSteps = project as ProjectWithSteps;
          projectWithSteps.fetchedSteps = [];
          return projectWithSteps;
        }
      }),
    );
    // Spread to guarantee a new array reference so FlatList re-renders cells
    setItems([...projectsWithSteps]);
    setIsLoading(false);
  };

  useEffect(() => {
    // Watch projects (items table)
    const projectsSubscription = itemRepository
      .observeByCategory('projects')
      .subscribe({
        next: async (projects: Item[]) => {
          await refreshProjects(projects);
        },
        error: err => {
          console.error('Error observing projects:', err);
          setIsLoading(false);
        },
      });

    // Watch project_steps table — fires when steps are created/deleted/updated
    const stepsSubscription = stepsCollection
      .query()
      .observe()
      .subscribe({
        next: async () => {
          if (projectsRef.current.length > 0) {
            await refreshProjects(projectsRef.current);
          }
        },
        error: err => {
          console.error('Error observing steps:', err);
        },
      });

    return () => {
      projectsSubscription.unsubscribe();
      stepsSubscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {items, isLoading};
}
