import React, { useMemo, useEffect, useRef } from "react";
import { useStore } from "../../store";
import { useShallow } from "zustand/react/shallow";
import { MusicCard } from "../Dashboard/MusicCard";
import { ListVideo } from "lucide-react";
import { formatDuration } from "../../utils/helpers";
import type { Track } from "../../types";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";

export function QueueView() {
  const { queue, queueIndex, currentTrack, isPlaying, setQueue, setIsPlaying } = useStore(
    useShallow((s) => ({
      queue: s.queue,
      queueIndex: s.queueIndex,
      currentTrack: s.currentTrack,
      isPlaying: s.isPlaying,
      setQueue: s.setQueue,
      setIsPlaying: s.setIsPlaying,
    }))
  );

  const nowPlayingRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // When the queue view opens, center the "Now playing" section
    if (nowPlayingRef.current) {
      setTimeout(() => {
        nowPlayingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
    }
  }, []);

  const MAX_VISIBLE_TRACKS = 10;

  const nextTracks = useMemo(() => {
    if (!queue.length) return [];
    return queue.slice(queueIndex + 1, queueIndex + 1 + MAX_VISIBLE_TRACKS);
  }, [queue, queueIndex]);
  


  const handleClearQueue = () => {
    setQueue(queue.slice(0, queueIndex + 1), queueIndex);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldGlobalIndex = parseInt((active.id as string).split("-")[1]);
      const newGlobalIndex = parseInt((over.id as string).split("-")[1]);

      const newQueue = [...queue];
      const [moved] = newQueue.splice(oldGlobalIndex, 1);
      newQueue.splice(newGlobalIndex, 0, moved);
      
      setQueue(newQueue, queueIndex);
    }
  };

  const SortableQueueTrackRow = ({ 
    track, 
    globalIndex,
    sortableId,
  }: { 
    track: Track, 
    globalIndex: number,
    sortableId: string,
  }) => {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id: sortableId });

    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      zIndex: isDragging ? 50 : undefined,
      opacity: isDragging ? 0.5 : 1,
      position: "relative" as const,
    };

    return (
      <div ref={setNodeRef} style={style}>
        <MusicCard
          track={track}
          allTracks={queue}
          trackIndex={globalIndex}
          viewMode="list"
          dragHandleProps={{ ...attributes, ...listeners }}
        />
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-8 py-8 flex-shrink-0 pb-4">
        <h1 className="font-display font-bold text-3xl text-text-primary tracking-tight">Queue</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-12">
        {queue.length === 0 ? (
          <div className="empty-state pt-16 flex flex-col items-center justify-center text-center">
            <ListVideo size={48} className="text-text-muted mb-4" />
            <h2 className="text-lg font-bold text-text-primary">Nothing playing</h2>
            <p className="text-text-secondary mt-1">Go add some tracks to play next.</p>
          </div>
        ) : (
          <div className="max-w-screen-xl mx-auto flex flex-col gap-8 w-full">
            


            {currentTrack && (
              <section ref={nowPlayingRef}>
                <h2 className="text-sm font-bold text-text-secondary mb-3 px-4">
                  Now playing
                </h2>
                <div className="flex flex-col">
                  <MusicCard 
                    track={currentTrack} 
                    allTracks={queue}
                    trackIndex={queueIndex}
                    viewMode="list"
                  />
                </div>
              </section>
            )}

            {nextTracks.length > 0 && (
              <section>
                <div className="flex items-center justify-between px-4 mb-3">
                  <h2 className="text-sm font-bold text-text-secondary">
                    Next from Queue
                  </h2>
                  <button 
                    onClick={handleClearQueue}
                    className="text-xs font-bold text-accent hover:text-accent-bright transition-colors uppercase tracking-wider"
                  >
                    Clear Queue
                  </button>
                </div>
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToWindowEdges]}
                >
                  <SortableContext
                    items={nextTracks.map((_, i) => `queue-${queueIndex + 1 + i}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="flex flex-col">
                      {nextTracks.map((track, i) => {
                        const globalIdx = queueIndex + 1 + i;
                        const sortableId = `queue-${globalIdx}`;
                        return (
                          <SortableQueueTrackRow 
                            key={sortableId}
                            sortableId={sortableId}
                            track={track} 
                            globalIndex={globalIdx}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </DndContext>
              </section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
