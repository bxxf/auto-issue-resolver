import { useState, useMemo, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import Spinner from "ink-spinner";
import type { AgentEvent } from "@bxxf/air-core";

import { ToolCall } from "./ToolCall.js";
import { ThinkingBlock } from "./ThinkingBlock.js";

interface AgentViewProps {
  events: AgentEvent[];
}

// Group related events together
interface EventGroup {
  id: string;
  type: "tool" | "thinking" | "message" | "phase";
  events: AgentEvent[];
}

export function AgentView({ events }: AgentViewProps) {
  const { stdout } = useStdout();
  const terminalHeight = stdout?.rows ?? 24;

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1); // -1 = no selection (view mode)
  const [viewOffset, setViewOffset] = useState(0); // For scrolling through visible items

  // Group events for display
  const groups = useMemo(() => {
    const result: EventGroup[] = [];
    let groupId = 0;

    for (const event of events) {
      if (event.type === "tool_call") {
        result.push({
          id: `tool-${groupId++}`,
          type: "tool",
          events: [event],
        });
      } else if (event.type === "thinking") {
        result.push({
          id: `thinking-${groupId++}`,
          type: "thinking",
          events: [event],
        });
      } else if (event.type === "message") {
        result.push({
          id: `message-${groupId++}`,
          type: "message",
          events: [event],
        });
      }
      // Skip phase_change events from the list - shown in status bar
    }

    return result;
  }, [events]);

  // Get current phase
  const currentPhase = useMemo(() => {
    const phaseEvents = events.filter((e) => e.type === "phase_change");
    return phaseEvents[phaseEvents.length - 1];
  }, [events]);

  // Calculate visible items based on terminal height
  const maxVisible = Math.max(5, terminalHeight - 8); // Leave room for header/footer

  // Auto-scroll to bottom when new events arrive (if not in selection mode)
  useEffect(() => {
    if (selectedIndex === -1 && groups.length > 0) {
      setViewOffset(Math.max(0, groups.length - maxVisible));
    }
  }, [groups.length, selectedIndex, maxVisible]);

  // Handle keyboard navigation
  useInput((input, key) => {
    const inSelectionMode = selectedIndex >= 0;

    // ESC - toggle selection mode
    if (key.escape) {
      if (inSelectionMode) {
        setSelectedIndex(-1); // Exit selection mode
        setExpandedId(null); // Collapse any expanded item
      } else {
        setSelectedIndex(Math.min(groups.length - 1, viewOffset)); // Enter selection mode
      }
      return;
    }

    // Navigation (works in both modes, but selection only moves in selection mode)
    if (key.upArrow || input === "k") {
      if (inSelectionMode) {
        const newIndex = Math.max(0, selectedIndex - 1);
        setSelectedIndex(newIndex);
        // Adjust view if selection goes above visible area
        if (newIndex < viewOffset) {
          setViewOffset(newIndex);
        }
      } else {
        setViewOffset((v) => Math.max(0, v - 1));
      }
    } else if (key.downArrow || input === "j") {
      if (inSelectionMode) {
        const newIndex = Math.min(groups.length - 1, selectedIndex + 1);
        setSelectedIndex(newIndex);
        // Adjust view if selection goes below visible area
        if (newIndex >= viewOffset + maxVisible) {
          setViewOffset(newIndex - maxVisible + 1);
        }
      } else {
        setViewOffset((v) => Math.min(Math.max(0, groups.length - maxVisible), v + 1));
      }
    }

    // Page Up/Down
    else if (key.pageUp) {
      const jump = Math.floor(maxVisible / 2);
      if (inSelectionMode) {
        const newIndex = Math.max(0, selectedIndex - jump);
        setSelectedIndex(newIndex);
        setViewOffset(Math.max(0, viewOffset - jump));
      } else {
        setViewOffset((v) => Math.max(0, v - jump));
      }
    } else if (key.pageDown) {
      const jump = Math.floor(maxVisible / 2);
      if (inSelectionMode) {
        const newIndex = Math.min(groups.length - 1, selectedIndex + jump);
        setSelectedIndex(newIndex);
        setViewOffset(Math.min(Math.max(0, groups.length - maxVisible), viewOffset + jump));
      } else {
        setViewOffset((v) => Math.min(Math.max(0, groups.length - maxVisible), v + jump));
      }
    }

    // g/G - go to top/bottom
    else if (input === "g") {
      if (inSelectionMode) {
        setSelectedIndex(0);
      }
      setViewOffset(0);
    } else if (input === "G") {
      if (inSelectionMode) {
        setSelectedIndex(groups.length - 1);
      }
      setViewOffset(Math.max(0, groups.length - maxVisible));
    }

    // Enter/Space - expand/collapse (only in selection mode)
    else if ((key.return || input === " ") && inSelectionMode) {
      const group = groups[selectedIndex];
      if (group) {
        setExpandedId((current) => (current === group.id ? null : group.id));
      }
    }

    // 'e' - enter selection mode and select last item
    else if (input === "e" && !inSelectionMode) {
      setSelectedIndex(groups.length - 1);
      setViewOffset(Math.max(0, groups.length - maxVisible));
    }
  });

  // Get visible slice
  const visibleGroups = groups.slice(viewOffset, viewOffset + maxVisible);
  const hasMoreAbove = viewOffset > 0;
  const hasMoreBelow = viewOffset + maxVisible < groups.length;

  const inSelectionMode = selectedIndex >= 0;

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Status line */}
      <Box marginBottom={1}>
        <Text color="green">
          <Spinner type="dots" />
        </Text>
        <Text> </Text>
        {currentPhase?.type === "phase_change" && (
          <Text color="cyan">[{currentPhase.phase}] </Text>
        )}
        <Text dimColor>
          {currentPhase?.type === "phase_change" ? currentPhase.message : "Working..."}
        </Text>
        <Text dimColor> ({groups.length} events)</Text>
      </Box>

      {/* Scroll indicator - above */}
      {hasMoreAbove && (
        <Text dimColor>  ↑ {viewOffset} more above</Text>
      )}

      {/* Event list */}
      <Box flexDirection="column">
        {visibleGroups.map((group) => {
          const globalIndex = groups.indexOf(group);
          const isSelected = inSelectionMode && globalIndex === selectedIndex;
          const isExpanded = expandedId === group.id;

          return (
            <Box key={group.id} flexDirection="column">
              {group.type === "tool" && (
                <ToolCall
                  event={group.events[0] as AgentEvent & { type: "tool_call" }}
                  isSelected={isSelected}
                  isExpanded={isExpanded}
                />
              )}
              {group.type === "thinking" && (
                <ThinkingBlock
                  event={group.events[0] as AgentEvent & { type: "thinking" }}
                  isSelected={isSelected}
                  isExpanded={isExpanded}
                />
              )}
              {group.type === "message" && (
                <MessageBlock
                  event={group.events[0] as AgentEvent & { type: "message" }}
                  isSelected={isSelected}
                  isExpanded={isExpanded}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Scroll indicator - below */}
      {hasMoreBelow && (
        <Text dimColor>  ↓ {groups.length - viewOffset - maxVisible} more below</Text>
      )}

      {/* Help */}
      <Box marginTop={1}>
        <Text dimColor>
          {inSelectionMode
            ? "↑↓/jk: move | Enter: expand | g/G: top/bottom | Esc: exit"
            : "↑↓/jk: scroll | e/Esc: select | g/G: top/bottom"
          }
        </Text>
      </Box>
    </Box>
  );
}

// Simple message block component
function MessageBlock({
  event,
  isSelected,
  isExpanded,
}: {
  event: AgentEvent & { type: "message" };
  isSelected: boolean;
  isExpanded: boolean;
}) {
  const preview = event.content.slice(0, 80);
  const hasMore = event.content.length > 80;

  return (
    <Box flexDirection="column">
      <Box>
        <Text color={isSelected ? "cyan" : undefined}>
          {isSelected ? ">" : " "}
        </Text>
        <Text color="gray"> Agent: </Text>
        <Text wrap="truncate">
          {isExpanded ? "" : preview}
          {!isExpanded && hasMore ? "..." : ""}
        </Text>
      </Box>
      {isExpanded && (
        <Box
          marginLeft={3}
          marginTop={1}
          marginBottom={1}
          borderStyle="single"
          borderColor="gray"
          paddingX={1}
        >
          <Text dimColor wrap="wrap">{event.content}</Text>
        </Box>
      )}
    </Box>
  );
}
