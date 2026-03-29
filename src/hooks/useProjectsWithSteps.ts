import {useState, useEffect} from 'react';
import {itemRepository} from '@services/database/repositories/ItemRepository';
import {stepsCollection} from '@services/database';
import Item from '@services/database/models/Item';
import ProjectStep from '@services/database/models/ProjectStep';
import {Q} from '@nozbe/watermelondb';


// ─── useProjectsWithSteps ──────────────────────────────────────────────────
// Special hook for projects that fetches steps eagerly

export interface ProjectWithSteps extends Item {
  fetchedSteps?: Array<{stepText: string; stepOrder: number}>;
}

export function useProjectsWithSteps() {
  const [items, setItems] = useState<ProjectWithSteps[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const subscription = itemRepository
      .observeByCategory('projects')
      .subscribe({
        next: async (projects: Item[]) => {
          // For each project, fetch its steps
          const projectsWithSteps = await Promise.all(
            projects.map(async project => {
              try {
                // Fetch steps for this project directly by project_id
                const steps = await stepsCollection
                  .query(Q.where('project_id', project.id))
                  .fetch();
                const sortedSteps = steps
                  .map((s: ProjectStep) => ({
                    stepText: s.stepText,
                    stepOrder: s.stepOrder,
                  }))
                  .sort((a, b) => a.stepOrder - b.stepOrder);

                const projectWithSteps = Object.create(project) as ProjectWithSteps;
                projectWithSteps.fetchedSteps = sortedSteps;
                return projectWithSteps;
              } catch (error) {
                console.error('Error fetching steps for project:', error);
                const projectWithSteps = Object.create(project) as ProjectWithSteps;
                projectWithSteps.fetchedSteps = [];
                return projectWithSteps;
              }
            }),
          );

          setItems(projectsWithSteps);
          setIsLoading(false);
        },
        error: err => {
          console.error('Error observing projects:', err);
          setIsLoading(false);
        },
      });

    return () => subscription.unsubscribe();
  }, []);

  return {items, isLoading};
}
