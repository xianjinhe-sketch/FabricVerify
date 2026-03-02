import * as XLSX from 'xlsx';
import { InspectionJob, RollData } from '../types';
import { calculateRollStats } from './scoring';

export const exportExcelReport = (job: InspectionJob) => {
  const selectedRolls = job.rolls.filter(r => r.isSelected);
  
  // Calculate totals
  let totalMetersInspected = 0;
  let totalPassedMeters = 0;
  let totalFailedMeters = 0;
  let totalRollsInspected = selectedRolls.length;
  let rollsGradedPassed = 0;
  let rollsGradedFailed = 0;
  let totalPoints = 0;
  let totalSquareYards = 0;

  selectedRolls.forEach(r => {
    const stats = calculateRollStats(r);
    const length = r.actualLength || r.length || 0;
    const width = r.cuttableWidth || r.width || 0;
    
    totalMetersInspected += length;
    if (stats.isPass) {
      totalPassedMeters += length;
      rollsGradedPassed++;
    } else {
      totalFailedMeters += length;
      rollsGradedFailed++;
    }
    
    totalPoints += stats.totalPoints;
    // Length in meters to yards: length * 1.09361
    // Width in inches to yards: width / 36
    const lengthYards = length * 1.09361;
    const widthYards = width / 36;
    totalSquareYards += lengthYards * widthYards;
  });

  const actualShipmentPenaltyPoints = totalSquareYards > 0 
    ? (totalPoints * 100 / totalSquareYards).toFixed(1) 
    : '0.0';

  // Create workbook and worksheet
  const wb = XLSX.utils.book_new();
  
  // Prepare data array
  const wsData: any[][] = [];
  
  // Header section
  wsData.push(['Report No.:', job.bookingId, '', '', '', 'Fabric Description:', job.fabricType, '', '', '', '', '', '', '', '', '', '', '', '']);
  wsData.push(['Order No.:', '', '', '', '', 'Inspection Date:', new Date().toLocaleDateString(), '', '', '', '', '', '', '', '', '', '', '', '']);
  wsData.push(['Supplier:', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  wsData.push([]); // Empty row
  
  // Table Headers Row 1
  wsData.push([
    'Color', 
    'dye lot no', 
    'Roll#', 
    'Dye lot\nby\nfactory', 
    'Shade', '', '', '', 
    'Hand\nFinish', 
    'Cuttable\nWidth', 
    'Full\nwidth', 
    'Ticket\nMeters/\nKG', 
    'Inspected\nMeters/KG', 
    'Knit\nInspected\nWeight', 
    'Fabric\nWeight', 
    'Total\nLinear\nPt', 
    'Points/\n100 sq. yd', 
    'Passed/\nFailed', 
    'Main\nDefect'
  ]);
  
  // Table Headers Row 2
  wsData.push([
    '', '', '', '', 
    'Against\nRef', 'End to\nEnd', 'Side to\nside', 'Side to\nCentre', 
    '', '', '', '', '', '', '', '', '', '', ''
  ]);

  // Data rows
  selectedRolls.forEach(r => {
    const stats = calculateRollStats(r);
    
    // Find main defect (the one with most points)
    let mainDefect = '';
    if (r.defects && r.defects.length > 0) {
      const defectPoints: Record<string, number> = {};
      r.defects.forEach(d => {
        defectPoints[d.name] = (defectPoints[d.name] || 0) + d.points;
      });
      mainDefect = Object.keys(defectPoints).reduce((a, b) => defectPoints[a] > defectPoints[b] ? a : b);
    }

    wsData.push([
      '', // Color
      r.dyeLot || '', 
      r.rollNo || '', 
      '', // Dye lot by factory
      '', '', '', '', // Shade
      '', // Hand Finish
      r.cuttableWidth || r.width || '', 
      r.width || '', 
      r.length || '', // Ticket Meters/KG
      r.actualLength || r.length || '', // Inspected Meters/KG
      '', // Knit Inspected Weight
      r.actualWeight || r.weight || '', // Fabric Weight
      stats.totalPoints, 
      stats.score.toFixed(1), 
      stats.isPass ? 'Passed' : 'Failed', 
      mainDefect
    ]);
  });

  // Empty rows before footer
  wsData.push([]);
  wsData.push([]);

  // Footer section
  wsData.push([
    '', 'Total Meters Inspected:', totalMetersInspected.toFixed(2), '', '', '', '', '', '', 'Total Rolls Inspected:', totalRollsInspected, '', '', '', '', '', '', '', ''
  ]);
  wsData.push([
    '', 'Total Passed Meters:', totalPassedMeters.toFixed(2), '', '', '', '', '', '', 'Rolls Graded Passed:', rollsGradedPassed, '', '', '', '', '', '', '', ''
  ]);
  wsData.push([
    '', 'Total Failed Meters:', totalFailedMeters.toFixed(2), '', '', '', '', '', '', 'Rolls Graded Failed:', rollsGradedFailed, '', '', '', '', '', '', '', ''
  ]);
  wsData.push([
    '', 'Maximum Shipment Penalty Points Per 100 Sq. Yards', job.passThreshold, '', '', '', '', '', '', 'Actual Shipment Penalty Points Per 100 Sq. Yards', actualShipmentPenaltyPoints, '', '', '', '', '', '', '', ''
  ]);
  wsData.push([
    '', 'Inspector:', '', '', '', 'Factory representative signature:', '', '', '', 'Date:', '', '', '', '', '', '', '', '', ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Merges
  ws['!merges'] = [
    // Header merges
    { s: { r: 0, c: 1 }, e: { r: 0, c: 4 } }, // Report No.
    { s: { r: 0, c: 6 }, e: { r: 0, c: 18 } }, // Fabric Description
    { s: { r: 1, c: 1 }, e: { r: 1, c: 4 } }, // Order No.
    { s: { r: 1, c: 6 }, e: { r: 1, c: 18 } }, // Inspection Date
    { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } }, // Supplier

    // Table header merges
    { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } }, // Color
    { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } }, // dye lot no
    { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } }, // Roll#
    { s: { r: 4, c: 3 }, e: { r: 5, c: 3 } }, // Dye lot by factory
    { s: { r: 4, c: 4 }, e: { r: 4, c: 7 } }, // Shade
    { s: { r: 4, c: 8 }, e: { r: 5, c: 8 } }, // Hand Finish
    { s: { r: 4, c: 9 }, e: { r: 5, c: 9 } }, // Cuttable Width
    { s: { r: 4, c: 10 }, e: { r: 5, c: 10 } }, // Full width
    { s: { r: 4, c: 11 }, e: { r: 5, c: 11 } }, // Ticket Meters/KG
    { s: { r: 4, c: 12 }, e: { r: 5, c: 12 } }, // Inspected Meters/KG
    { s: { r: 4, c: 13 }, e: { r: 5, c: 13 } }, // Knit Inspected Weight
    { s: { r: 4, c: 14 }, e: { r: 5, c: 14 } }, // Fabric Weight
    { s: { r: 4, c: 15 }, e: { r: 5, c: 15 } }, // Total Linear Pt
    { s: { r: 4, c: 16 }, e: { r: 5, c: 16 } }, // Points/ 100 sq. yd
    { s: { r: 4, c: 17 }, e: { r: 5, c: 17 } }, // Passed/ Failed
    { s: { r: 4, c: 18 }, e: { r: 5, c: 18 } }, // Main Defect

    // Footer merges
    { s: { r: wsData.length - 5, c: 2 }, e: { r: wsData.length - 5, c: 4 } },
    { s: { r: wsData.length - 4, c: 2 }, e: { r: wsData.length - 4, c: 4 } },
    { s: { r: wsData.length - 3, c: 2 }, e: { r: wsData.length - 3, c: 4 } },
    { s: { r: wsData.length - 2, c: 2 }, e: { r: wsData.length - 2, c: 4 } },
    { s: { r: wsData.length - 1, c: 2 }, e: { r: wsData.length - 1, c: 4 } },
    
    { s: { r: wsData.length - 5, c: 10 }, e: { r: wsData.length - 5, c: 12 } },
    { s: { r: wsData.length - 4, c: 10 }, e: { r: wsData.length - 4, c: 12 } },
    { s: { r: wsData.length - 3, c: 10 }, e: { r: wsData.length - 3, c: 12 } },
    { s: { r: wsData.length - 2, c: 10 }, e: { r: wsData.length - 2, c: 12 } },
    { s: { r: wsData.length - 1, c: 10 }, e: { r: wsData.length - 1, c: 12 } },
  ];

  // Column widths
  ws['!cols'] = [
    { wch: 10 }, // Color
    { wch: 12 }, // dye lot no
    { wch: 10 }, // Roll#
    { wch: 12 }, // Dye lot by factory
    { wch: 10 }, // Against Ref
    { wch: 10 }, // End to End
    { wch: 10 }, // Side to side
    { wch: 10 }, // Side to Centre
    { wch: 10 }, // Hand Finish
    { wch: 10 }, // Cuttable Width
    { wch: 10 }, // Full width
    { wch: 12 }, // Ticket Meters/KG
    { wch: 12 }, // Inspected Meters/KG
    { wch: 12 }, // Knit Inspected Weight
    { wch: 10 }, // Fabric Weight
    { wch: 10 }, // Total Linear Pt
    { wch: 12 }, // Points/ 100 sq. yd
    { wch: 10 }, // Passed/ Failed
    { wch: 15 }, // Main Defect
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Inspection Report");
  XLSX.writeFile(wb, `Fabric_Inspection_Report_${job.bookingId}.xlsx`);
};
