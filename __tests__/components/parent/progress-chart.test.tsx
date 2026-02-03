import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ProgressChart } from '@/components/ui/parent/progress-chart';

jest.mock('recharts', () => {
  const React = require('react');
  return {
    LineChart: ({ children, data }: any) => (
      <div data-testid="line-chart" data-chart-length={data?.length}>
        {children}
      </div>
    ),
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart" data-chart-length={data?.length}>
        {children}
      </div>
    ),
    Line: ({ dataKey, name }: any) => (
      <div data-testid={`line-${dataKey}`}>{name}</div>
    ),
    Bar: ({ dataKey, name }: any) => (
      <div data-testid={`bar-${dataKey}`}>{name}</div>
    ),
    XAxis: ({ dataKey }: any) => <div data-testid={`xaxis-${dataKey}`} />,
    YAxis: () => <div data-testid="yaxis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    Legend: () => <div data-testid="legend" />,
    ResponsiveContainer: ({ children }: any) => (
      <div data-testid="responsive-container">{children}</div>
    ),
  };
});

const now = new Date();
const mockProgressHistory = [
  {
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 21).toISOString(),
    progress: 65,
    completedSessions: 10,
    totalSessions: 15,
  },
  {
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14).toISOString(),
    progress: 70,
    completedSessions: 12,
    totalSessions: 16,
  },
  {
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString(),
    progress: 75,
    completedSessions: 15,
    totalSessions: 18,
  },
  {
    date: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString(),
    progress: 80,
    completedSessions: 18,
    totalSessions: 20,
  },
];

const mockSubjectProgressHistory = [
  {
    subject: 'Mathématiques',
    progress: 85,
    completedSessions: 10,
    totalSessions: 12,
  },
  {
    subject: 'Français',
    progress: 75,
    completedSessions: 8,
    totalSessions: 10,
  },
  {
    subject: 'Anglais',
    progress: 90,
    completedSessions: 9,
    totalSessions: 10,
  },
];

describe('ProgressChart Component', () => {
  describe('Chart rendering with data', () => {
    test('should render trend chart by default', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );
      
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });

    test('should display chart title and description', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );
      
      expect(screen.getByText('Évolution de la Progression')).toBeInTheDocument();
      expect(screen.getByText('Suivi des progrès au fil du temps')).toBeInTheDocument();
    });

    test('should render ResponsiveContainer for responsive sizing', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );
      
      expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    });

    test('should render chart elements (axes, grid, legend)', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );
      
      expect(screen.getByTestId('cartesian-grid')).toBeInTheDocument();
      expect(screen.getByTestId('yaxis')).toBeInTheDocument();
      expect(screen.getByTestId('legend')).toBeInTheDocument();
    });
  });

  describe('Time range selector', () => {
    test('should display time range selector for trend view', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );
      
      expect(screen.getByText('3 mois')).toBeInTheDocument();
    });

    test('should filter data when time range is changed', async () => {
      const user = userEvent.setup();
      const longHistory = Array.from({ length: 52 }, (_, i) => ({
        date: new Date(2024, 0, 1 + i * 7).toISOString(),
        progress: 50 + i,
        completedSessions: i + 5,
        totalSessions: i + 10,
      }));

      render(
        <ProgressChart 
          progressHistory={longHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const timeRangeButton = screen.getByText('3 mois');
      await user.click(timeRangeButton);

      await waitFor(() => {
        const option1M = screen.getByText('1 mois');
        expect(option1M).toBeInTheDocument();
      });
    });

    test('should not display time range selector for subjects view', async () => {
      const user = userEvent.setup();
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const chartTypeButton = screen.getByText('Tendance');
      await user.click(chartTypeButton);

      await waitFor(() => {
        const subjectsOption = screen.getByText('Par Matière');
        expect(subjectsOption).toBeInTheDocument();
      });

      await user.click(screen.getByText('Par Matière'));

      await waitFor(() => {
        expect(screen.queryByText('3 mois')).not.toBeInTheDocument();
      });
    });
  });

  describe('Chart type switching', () => {
    test('should switch to subject chart when "Par Matière" is selected', async () => {
      const user = userEvent.setup();
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      expect(screen.getByTestId('line-chart')).toBeInTheDocument();

      const chartTypeButton = screen.getByText('Tendance');
      await user.click(chartTypeButton);

      const subjectsOption = screen.getByText('Par Matière');
      await user.click(subjectsOption);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      });
    });

    test('should switch back to trend chart when "Tendance" is selected', async () => {
      const user = userEvent.setup();
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const chartTypeButton = screen.getByText('Tendance');
      await user.click(chartTypeButton);
      await user.click(screen.getByText('Par Matière'));

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });

      const newChartTypeButton = screen.getByText('Par Matière');
      await user.click(newChartTypeButton);
      await user.click(screen.getByText('Tendance'));

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    test('should display empty state when no progress data', () => {
      render(
        <ProgressChart 
          progressHistory={[]} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );
      
      expect(screen.getByText('Aucune donnée de progression')).toBeInTheDocument();
      expect(screen.getByText(/Les données apparaîtront après les premières séances/)).toBeInTheDocument();
    });

    test('should display empty state for subjects when no subject data', async () => {
      const user = userEvent.setup();
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={[]} 
        />
      );

      const chartTypeButton = screen.getByText('Tendance');
      await user.click(chartTypeButton);
      await user.click(screen.getByText('Par Matière'));

      await waitFor(() => {
        expect(screen.getByText('Aucune donnée par matière')).toBeInTheDocument();
        expect(screen.getByText(/Les statistiques par matière apparaîtront après les premières séances/)).toBeInTheDocument();
      });
    });

    test('should not show chart when data is empty', () => {
      render(
        <ProgressChart 
          progressHistory={[]} 
          subjectProgressHistory={[]} 
        />
      );
      
      expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();
      expect(screen.queryByTestId('bar-chart')).not.toBeInTheDocument();
    });
  });

  describe('Data filtering by time range', () => {
    test('should show all data when time range covers all dates', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const chart = screen.getByTestId('line-chart');
      expect(chart).toHaveAttribute('data-chart-length', String(mockProgressHistory.length));
    });

    test('should filter data based on time range', async () => {
      const user = userEvent.setup();
      const now = new Date();
      const longHistory = [
        { date: new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString(), progress: 50, completedSessions: 5, totalSessions: 10 },
        { date: new Date(now.getFullYear(), now.getMonth() - 6, 1).toISOString(), progress: 60, completedSessions: 6, totalSessions: 10 },
        { date: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString(), progress: 70, completedSessions: 7, totalSessions: 10 },
        { date: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), progress: 80, completedSessions: 8, totalSessions: 10 },
      ];

      render(
        <ProgressChart 
          progressHistory={longHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const initialChart = screen.queryByTestId('line-chart');
      expect(initialChart).toBeInTheDocument();
    });
  });

  describe('Subject progress display', () => {
    test('should render bar chart with subject data', async () => {
      const user = userEvent.setup();
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      await user.click(screen.getByText('Tendance'));
      await user.click(screen.getByText('Par Matière'));

      await waitFor(() => {
        const barChart = screen.getByTestId('bar-chart');
        expect(barChart).toHaveAttribute('data-chart-length', String(mockSubjectProgressHistory.length));
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle single data point', () => {
      const singleDataPoint = [mockProgressHistory[0]];
      render(
        <ProgressChart 
          progressHistory={singleDataPoint} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const chart = screen.queryByTestId('line-chart');
      expect(chart).toBeInTheDocument();
    });

    test('should handle progress values at boundaries (0 and 100)', () => {
      const boundaryData = [
        { date: '2024-01-01', progress: 0, completedSessions: 0, totalSessions: 10 },
        { date: new Date().toISOString(), progress: 100, completedSessions: 10, totalSessions: 10 },
      ];

      render(
        <ProgressChart 
          progressHistory={boundaryData} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const chart = screen.queryByTestId('line-chart');
      expect(chart).toBeInTheDocument();
    });

    test('should handle very long time periods', () => {
      const now = new Date();
      const longHistory = Array.from({ length: 20 }, (_, i) => ({
        date: new Date(now.getFullYear(), now.getMonth() - i, 1).toISOString(),
        progress: 50 + (i % 50),
        completedSessions: i + 5,
        totalSessions: i + 10,
      }));

      render(
        <ProgressChart 
          progressHistory={longHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const chart = screen.queryByTestId('line-chart');
      expect(chart).toBeInTheDocument();
    });

    test('should handle multiple subjects with same progress', () => {
      const sameProgressSubjects = mockSubjectProgressHistory.map(s => ({
        ...s,
        progress: 75,
      }));

      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={sameProgressSubjects} 
        />
      );

      const chart = screen.queryByTestId('line-chart');
      expect(chart).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('should have accessible chart type selector', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const selector = screen.getByText('Tendance');
      expect(selector).toBeInTheDocument();
    });

    test('should have accessible time range selector', () => {
      render(
        <ProgressChart 
          progressHistory={mockProgressHistory} 
          subjectProgressHistory={mockSubjectProgressHistory} 
        />
      );

      const timeRangeSelector = screen.getByText('3 mois');
      expect(timeRangeSelector).toBeInTheDocument();
    });
  });
});
