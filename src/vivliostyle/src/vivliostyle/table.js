/**
 * Copyright 2016 Trim-marks Inc.
 *
 * Vivliostyle.js is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Vivliostyle.js is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Vivliostyle.js.  If not, see <http://www.gnu.org/licenses/>.
 *
 * @fileoverview Table formatting context and layout.
 */
goog.provide("vivliostyle.table");

goog.require("goog.asserts");
goog.require("adapt.base");
goog.require("vivliostyle.plugin");
goog.require("adapt.task");
goog.require("adapt.vtree");
goog.require("vivliostyle.break");
goog.require("adapt.layout");
goog.require("vivliostyle.layoututil");
goog.require("vivliostyle.repetitiveelements");

goog.scope(function() {
    /** @const */ var LayoutIterator = vivliostyle.layoututil.LayoutIterator;
    /** @const */ var EdgeSkipper = vivliostyle.layoututil.EdgeSkipper;
    /** @const */ var PseudoColumn = vivliostyle.layoututil.PseudoColumn;
    /** @const */ var EdgeBreakPosition = adapt.layout.EdgeBreakPosition;
    /** @const */ var AbstractLayoutRetryer = vivliostyle.layoututil.AbstractLayoutRetryer;
    /** @const */ var LayoutEntireBlock = vivliostyle.repetitiveelements.LayoutEntireBlock;
    /** @const */ var LayoutFragmentedBlock = vivliostyle.repetitiveelements.LayoutFragmentedBlock;
    /** @const */ var RepetitiveElementsOwnerFormattingContext = vivliostyle.repetitiveelements.RepetitiveElementsOwnerFormattingContext;
    /** @const */ var RepetitiveElementsOwnerLayoutConstraint = vivliostyle.repetitiveelements.RepetitiveElementsOwnerLayoutConstraint;

    /**
     * @param {number} rowIndex
     * @param {Node} sourceNode
     * @constructor
     */
    vivliostyle.table.TableRow = function(rowIndex, sourceNode) {
        /** @const */ this.rowIndex = rowIndex;
        /** @const */ this.sourceNode = sourceNode;
        /** @const {!Array<!vivliostyle.table.TableCell>} */ this.cells = [];
    };
    /** @const */ var TableRow = vivliostyle.table.TableRow;

    /**
     * @param {!vivliostyle.table.TableCell} cell
     */
    TableRow.prototype.addCell = function(cell) {
        this.cells.push(cell);
    };

    /**
     * @returns {number}
     */
    TableRow.prototype.getMinimumHeight = function() {
        return Math.min.apply(null, this.cells.map(function(c) { return c.height; }));
    };

    /**
     * @param {number} rowIndex
     * @param {number} columnIndex
     * @param {!Element} viewElement
     * @constructor
     */
    vivliostyle.table.TableCell = function(rowIndex, columnIndex, viewElement) {
        /** @const */ this.rowIndex = rowIndex;
        /** @const */ this.columnIndex = columnIndex;
        /** @type {?Element} */ this.viewElement = viewElement;
        /** @const {number} */ this.colSpan = viewElement.colSpan || 1;
        /** @const {number} */ this.rowSpan = viewElement.rowSpan || 1;
        /** @type {number} */ this.height = 0;
        /** @type {vivliostyle.table.TableSlot} */ this.anchorSlot = null;
    };
    /** @const */ var TableCell = vivliostyle.table.TableCell;

    /**
     * @param {number} height
     */
    TableCell.prototype.setHeight = function(height) {
        this.height = height;
    };

    /**
     * @param {!vivliostyle.table.TableSlot} slot
     */
    TableCell.prototype.setAnchorSlot = function(slot) {
        this.anchorSlot = slot;
    };

    /**
     * @param {number} rowIndex
     * @param {number} columnIndex
     * @param {!vivliostyle.table.TableCell} cell
     * @constructor
     */
    vivliostyle.table.TableSlot = function(rowIndex, columnIndex, cell) {
        /** @const */ this.rowIndex = rowIndex;
        /** @const */ this.columnIndex = columnIndex;
        /** @const */ this.cell = cell;
    };
    /** @const */ var TableSlot = vivliostyle.table.TableSlot;

    /**
     * @param {!adapt.layout.Column} column
     * @param {!Element} pseudoColumnContainer
     * @param {!adapt.vtree.NodeContext} cellNodeContext
     * @constructor
     */
    vivliostyle.table.TableCellFragment = function(column, pseudoColumnContainer, cellNodeContext) {
        /** @const */ this.column = column;
        /** @const */ this.cellNodeContext = cellNodeContext;
        /** @const */ this.pseudoColumn = new PseudoColumn(column, pseudoColumnContainer, cellNodeContext);
        /** @type {boolean} */ this.empty = false;
    };
    /** @const */ var TableCellFragment = vivliostyle.table.TableCellFragment;

    /**
     * @returns {!adapt.layout.BreakPositionAndNodeContext}
     */
    TableCellFragment.prototype.findAcceptableBreakPosition = function() {
        var element = /** @type {Element} */ (this.cellNodeContext.viewNode);
        var verticalAlign = this.cellNodeContext.verticalAlign;
        if (verticalAlign === "middle" || verticalAlign === "bottom") {
            adapt.base.setCSSProperty(element, "vertical-align", "top");
        }
        var bp = this.pseudoColumn.findAcceptableBreakPosition(true);
        adapt.base.setCSSProperty(element, "vertical-align", verticalAlign);
        return bp;
    };

    /**
     * @param {!Element} viewNode
     * @param {string} side
     * @constructor
     */
    vivliostyle.table.TableCaptionView = function(viewNode, side) {
        /** @const */ this.viewNode = viewNode;
        /** @const */ this.side = side;
    };
    /** @const */ var TableCaptionView = vivliostyle.table.TableCaptionView;

    /**
     * @param {!adapt.vtree.NodeContext} position
     * @param {?string} breakOnEdge
     * @param {boolean} overflows
     * @param {number} columnBlockSize
     * @constructor
     * @extends {adapt.layout.EdgeBreakPosition}
     */
    vivliostyle.table.BetweenTableRowBreakPosition = function(position,
        breakOnEdge, overflows, columnBlockSize) {
        EdgeBreakPosition.call(this, position, breakOnEdge, overflows, columnBlockSize);
        /** @private @const */ this.formattingContext = position.formattingContext;
        /** Array<!adapt.layout.BreakPositionAndNodeContext> */ this.acceptableCellBreakPositions = null;
        /** @private @type {number|null} */ this.rowIndex = null;
    };
    /** @const */ var BetweenTableRowBreakPosition = vivliostyle.table.BetweenTableRowBreakPosition;
    goog.inherits(BetweenTableRowBreakPosition, EdgeBreakPosition);

    /**
     * @override
     */
    BetweenTableRowBreakPosition.prototype.findAcceptableBreak = function(column, penalty) {
        var breakNodeContext = EdgeBreakPosition.prototype.findAcceptableBreak.call(this, column, penalty);
        if (penalty < this.getMinBreakPenalty())
            return null;
        var allCellsBreakable = this.getAcceptableCellBreakPositions().every(function(bp) {
            return !!bp.nodeContext;
        });
        if (allCellsBreakable) {
            return breakNodeContext;
        } else {
            return null;
        }
    };

    /**
     * @override
     */
    BetweenTableRowBreakPosition.prototype.getMinBreakPenalty = function() {
        var penalty = EdgeBreakPosition.prototype.getMinBreakPenalty.call(this);
        this.getAcceptableCellBreakPositions().forEach(function(bp) {
            penalty += bp.breakPosition.getMinBreakPenalty();
        });
        return penalty;
    };

    /**
     * @returns {!Array<adapt.layout.BreakPositionAndNodeContext>}
     */
    BetweenTableRowBreakPosition.prototype.getAcceptableCellBreakPositions = function() {
        if (!this.acceptableCellBreakPositions) {
            var formattingContext = this.formattingContext;
            var cellFragments = this.getCellFragments();
            this.acceptableCellBreakPositions = cellFragments.map(function(cellFragment) {
                return cellFragment.findAcceptableBreakPosition();
            });
        }
        return this.acceptableCellBreakPositions;
    };

    /**
     * @private
     * @return {number}
     */
    BetweenTableRowBreakPosition.prototype.getRowIndex = function() {
        if (this.rowIndex != null) return this.rowIndex;
        return this.rowIndex = this.formattingContext.findRowIndexBySourceNode(this.position.sourceNode);
    };

    /**
     * @private
     */
    BetweenTableRowBreakPosition.prototype.getCellFragments = function() {
        return this.formattingContext.getRowSpanningCellsOverflowingTheRow(this.getRowIndex()).map(
                this.formattingContext.getCellFragmentOfCell, this.formattingContext);
    };

    /**
     * @param {number} rowIndex
     * @param {!adapt.vtree.NodeContext} beforeNodeContext
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @constructor
     * @extends {adapt.layout.AbstractBreakPosition}
     */
    vivliostyle.table.InsideTableRowBreakPosition = function(
        rowIndex, beforeNodeContext, formattingContext) {
        adapt.layout.AbstractBreakPosition.call(this);
        /** @const */ this.rowIndex = rowIndex;
        /** @const */ this.beforeNodeContext = beforeNodeContext;
        /** @const */ this.formattingContext = formattingContext;
        /** @type {Array<!adapt.layout.BreakPositionAndNodeContext>} */ this.acceptableCellBreakPositions = null;
    };
    /** @const */ var InsideTableRowBreakPosition = vivliostyle.table.InsideTableRowBreakPosition;
    goog.inherits(InsideTableRowBreakPosition, adapt.layout.AbstractBreakPosition);

    /**
     * @override
     */
    InsideTableRowBreakPosition.prototype.findAcceptableBreak = function(column, penalty) {
        if (penalty < this.getMinBreakPenalty())
            return null;
        var cellFragments = this.getCellFragments();
        var acceptableCellBreakPositions = this.getAcceptableCellBreakPositions();
        var allCellsBreakable = acceptableCellBreakPositions.every(function(bp) {
            return !!bp.nodeContext;
        }) && acceptableCellBreakPositions.some(function(bp, index) {
            var pseudoColumn = cellFragments[index].pseudoColumn;
            var nodeContext = bp.nodeContext;
            return !pseudoColumn.isStartNodeContext(nodeContext) && !pseudoColumn.isLastAfterNodeContext(nodeContext);
        });
        this.beforeNodeContext.overflow = acceptableCellBreakPositions.some(function(bp) {
            return bp.nodeContext && bp.nodeContext.overflow;
        });
        if (allCellsBreakable) {
            return this.beforeNodeContext;
        } else {
            return null;
        }
    };

    /**
     * @override
     */
    InsideTableRowBreakPosition.prototype.getMinBreakPenalty = function() {
        var formattingContext = this.formattingContext;
        var row = formattingContext.getRowByIndex(this.rowIndex);
        var penalty = 0;
        if (!formattingContext.isFreelyFragmentableRow(row)) {
            penalty += 10;
        }
        this.getAcceptableCellBreakPositions().forEach(function(bp) {
            penalty += bp.breakPosition.getMinBreakPenalty();
        });
        return penalty;
    };

    /**
     * @returns {!Array<adapt.layout.BreakPositionAndNodeContext>}
     */
    InsideTableRowBreakPosition.prototype.getAcceptableCellBreakPositions = function() {
        if (!this.acceptableCellBreakPositions) {
            var cellFragments = this.getCellFragments();
            this.acceptableCellBreakPositions = cellFragments.map(function(cellFragment) {
                return cellFragment.findAcceptableBreakPosition();
            });
        }
        return this.acceptableCellBreakPositions;
    };


    /**
     * @private
     */
    InsideTableRowBreakPosition.prototype.getCellFragments = function() {
        return this.formattingContext.getCellsFallingOnRow(this.rowIndex).map(
                this.formattingContext.getCellFragmentOfCell, this.formattingContext);
    };

    /**
     * @typedef {{
     *     cellNodePosition: !adapt.vtree.NodePosition,
     *     breakChunkPosition: !adapt.vtree.ChunkPosition,
     *     cell: !vivliostyle.table.TableCell
     * }}
     */
    vivliostyle.table.BrokenTableCellPosition;

    /**
     * @param {adapt.vtree.FormattingContext} parent
     * @param {!Element} tableSourceNode Source node of the table
     * @constructor
     * @implements {adapt.vtree.FormattingContext}
     * @extends {vivliostyle.repetitiveelements.RepetitiveElementsOwnerFormattingContext}
     */
    vivliostyle.table.TableFormattingContext = function(parent, tableSourceNode) {
        RepetitiveElementsOwnerFormattingContext.call(this, parent, tableSourceNode);
        /** @const */ this.tableSourceNode = tableSourceNode;
        /** @type {boolean} */ this.vertical = false;
        /** @type {number} */ this.columnCount = -1;
        /** @type {number} */ this.tableWidth = 0;
        /** @const {!Array<vivliostyle.table.TableCaptionView>} */ this.captions = [];
        /** @type {DocumentFragment} */ this.colGroups = null;
        /** @type {Array<number>} */ this.colWidths = null;
        /** @type {number} */ this.inlineBorderSpacing = 0;
        /** @const {!Array<!vivliostyle.table.TableRow>} */ this.rows = [];
        /** @const {!Array<!Array<!vivliostyle.table.TableSlot>>} */ this.slots = [];
        /** @type {!Array<!Array<!vivliostyle.table.TableCellFragment>>} */ this.cellFragments = [];
        /** @type {Element} */ this.lastRowViewNode = null;
        /** @type {!Array<!vivliostyle.table.BrokenTableCellPosition>} */ this.cellBreakPositions = [];
        /** @type {vivliostyle.repetitiveelements.RepetitiveElements} */ this.repetitiveElements = null;
    };
    /** @const */ var TableFormattingContext = vivliostyle.table.TableFormattingContext;
    goog.inherits(TableFormattingContext, RepetitiveElementsOwnerFormattingContext);

    /**
     * @override
     */
    TableFormattingContext.prototype.getName = function() {
        return "Table formatting context (vivliostyle.table.TableFormattingContext)";
    };

    /**
     * @override
     */
    TableFormattingContext.prototype.isFirstTime = function(nodeContext, firstTime) {
        if (!firstTime) {
            return firstTime;
        }
        switch (nodeContext.display) {
            case "table-row":
                return this.cellBreakPositions.length === 0;
            case "table-cell":
                return !this.cellBreakPositions.some(function(p) {
                    return p.cellNodePosition.steps[0].node === nodeContext.sourceNode;
                });
            default:
                return firstTime;
        }
    };

    /**
     * @override
     */
    TableFormattingContext.prototype.getParent = function() {
        return this.parent;
    };

    TableFormattingContext.prototype.finishFragment = function() {
        this.cellFragments = [];
    };

    /**
     * @param {number} rowIndex
     * @param {!vivliostyle.table.TableRow} row
     */
    TableFormattingContext.prototype.addRow = function(rowIndex, row) {
        this.rows[rowIndex] = row;
    };

    /**
     * @param {number} rowIndex
     * @returns {!Array<!vivliostyle.table.TableSlot>}
     */
    TableFormattingContext.prototype.getRowSlots = function(rowIndex) {
        var rowSlots = this.slots[rowIndex];
        if (!rowSlots) {
            rowSlots = this.slots[rowIndex] = [];
        }
        return rowSlots;
    };

    /**
     * @param {number} rowIndex
     * @param {!vivliostyle.table.TableCell} cell
     */
    TableFormattingContext.prototype.addCell = function(rowIndex, cell) {
        var row = this.rows[rowIndex];
        if (!row) {
            this.addRow(rowIndex, new TableRow(rowIndex, null));
            row = this.rows[rowIndex];
        }
        goog.asserts.assert(row);
        row.addCell(cell);
        var rowUpper = rowIndex + cell.rowSpan;
        var rowSlots = this.getRowSlots(rowIndex);
        var startColIndex = 0;
        while (rowSlots[startColIndex]) {
            startColIndex++;
        }
        for (; rowIndex < rowUpper; rowIndex++) {
            rowSlots = this.getRowSlots(rowIndex);
            for (var i = startColIndex; i < startColIndex + cell.colSpan; i++) {
                var slot = rowSlots[i] = new TableSlot(rowIndex, i, cell);
                if (!cell.anchorSlot) {
                    cell.setAnchorSlot(slot);
                }
            }
        }
    };

    /**
     * @param {number} index
     * @returns {!vivliostyle.table.TableRow}
     */
    TableFormattingContext.prototype.getRowByIndex = function(index) {
        var row = this.rows[index];
        goog.asserts.assert(row);
        return row;
    };

    /**
     * @param {!Node} sourceNode
     * @returns {number}
     */
    TableFormattingContext.prototype.findRowIndexBySourceNode = function(sourceNode) {
        return this.rows.findIndex(function(row) {
            return sourceNode === row.sourceNode;
        });
    };

    /**
     * @param {number} rowIndex
     * @param {number} columnIndex
     * @param {!vivliostyle.table.TableCellFragment} cellFragment
     */
    TableFormattingContext.prototype.addCellFragment = function(rowIndex, columnIndex, cellFragment) {
        var list = this.cellFragments[rowIndex];
        if (!list) {
            list = this.cellFragments[rowIndex] = [];
        }
        list[columnIndex] = cellFragment;
    };

    /**
     * @param {number} rowIndex
     * @returns {!Array<!vivliostyle.table.TableCell>}
     */
    TableFormattingContext.prototype.getCellsFallingOnRow = function(rowIndex) {
        var rowSlots = this.getRowSlots(rowIndex);
        return rowSlots.reduce(function(uniqueCells, slot) {
            if (slot.cell !== uniqueCells[uniqueCells.length - 1]) {
                return uniqueCells.concat(slot.cell);
            } else {
                return uniqueCells;
            }
        }, []);
    };

    /**
     * @param {number} rowIndex
     * @returns {!Array<!vivliostyle.table.TableCell>}
     */
    TableFormattingContext.prototype.getRowSpanningCellsOverflowingTheRow = function(rowIndex) {
        return this.getCellsFallingOnRow(rowIndex).filter(function(cell) {
            return cell.rowIndex + cell.rowSpan - 1 > rowIndex;
        });
    };


    /**
     * @param {!vivliostyle.table.TableCell} cell
     * @returns {vivliostyle.table.TableCellFragment}
     */
    TableFormattingContext.prototype.getCellFragmentOfCell = function(cell) {
        return this.cellFragments[cell.rowIndex]
          && this.cellFragments[cell.rowIndex][cell.columnIndex];
    };

    /**
     * @param {!vivliostyle.table.TableRow} row
     * @returns {boolean}
     */
    TableFormattingContext.prototype.isFreelyFragmentableRow = function(row) {
        return row.getMinimumHeight() > this.tableWidth / 2;
    };

    /**
     * @returns {number}
     */
    TableFormattingContext.prototype.getColumnCount = function() {
        if (this.columnCount < 0) {
            this.columnCount = Math.max.apply(null, this.rows.map(function(row) {
                return row.cells.reduce(function(sum, c) {
                    return sum + c.colSpan;
                }, 0);
            }));
        }
        return this.columnCount;
    };

    /**
     * @param {!adapt.vtree.ClientLayout} clientLayout
     */
    TableFormattingContext.prototype.updateCellSizes = function(clientLayout) {
        this.rows.forEach(function(row) {
            row.cells.forEach(function(cell) {
                var rect = clientLayout.getElementClientRect(cell.viewElement);
                cell.viewElement = null;
                cell.setHeight(this.vertical ? rect["width"] : rect["height"]);
            }, this);
        }, this);
    };

    /**
     * @param {adapt.layout.Column} column
     * @return {({ rowIndex: number, columnIndex: number }|null)} position
     */
    TableFormattingContext.prototype.findCellFromColumn = function(column) {
        if (!column) return null;
        var tableCell = null;
        loop: for (var row=0; row < this.cellFragments.length; row++) {
            if (!this.cellFragments[row]) continue;
            for (var col=0; col < this.cellFragments[row].length; col++) {
                if (!this.cellFragments[row][col]) continue;
                if (column === this.cellFragments[row][col].pseudoColumn.getColumn()) {
                    tableCell = this.rows[row].cells[col];
                    break loop;
                }
            }
        }
        if (!tableCell) return null;
        for (; row < this.slots.length; row++) {
            for (; col < this.slots[row].length; col++) {
                var slot = this.slots[row][col];
                if (slot.cell === tableCell) {
                    return {rowIndex: slot.rowIndex, columnIndex: slot.columnIndex };
                }
            }
        }
        return null;
    };

    /**
     * @param {({ rowIndex: number, columnIndex: number }|null)} position
     * @return {!Array.<!vivliostyle.repetitiveelements.ElementsOffset>}
     */
    TableFormattingContext.prototype.collectElementsOffsetOfUpperCells = function(position) {
        var collected = [];
        return this.slots.reduce(function(repetitiveElements, row, index) {
            if (index >= position.rowIndex) return repetitiveElements;
            var cellFragment = this.getCellFragmentOfCell(row[position.columnIndex].cell);
            if (!cellFragment || collected.indexOf(cellFragment) >= 0) return repetitiveElements;
            this.collectElementsOffsetFromColumn(cellFragment.pseudoColumn.getColumn(), repetitiveElements);
            collected.push(cellFragment);
            return repetitiveElements;
        }.bind(this), /** @type {!Array.<!vivliostyle.repetitiveelements.ElementsOffset>} */ ([]));
    };

    /**
     * @return {!Array.<!vivliostyle.repetitiveelements.ElementsOffset>}
     */
    TableFormattingContext.prototype.collectElementsOffsetOfHighestColumn = function() {
        var elementsInColumn = [];
        this.rows.forEach(function(row) {
            row.cells.forEach(function(cell, index) {
                if (!elementsInColumn[index]) elementsInColumn[index] = {collected:[], elements:[]};
                var state = elementsInColumn[index];
                var cellFragment = this.getCellFragmentOfCell(cell);
                if (!cellFragment || state.collected.indexOf(cellFragment) >= 0) return;
                this.collectElementsOffsetFromColumn(cellFragment.pseudoColumn.getColumn(), state.elements);
                state.collected.push(cellFragment);
            }.bind(this));
        }.bind(this));
        return [
            new ElementsOffsetOfTableCell(elementsInColumn.map(function(entry) { return entry.elements; }))
        ];
    };

    /**
     * @private
     * @param {!adapt.layout.Column} column
     * @param {!Array.<!vivliostyle.repetitiveelements.ElementsOffset>} repetitiveElements
     */
    TableFormattingContext.prototype.collectElementsOffsetFromColumn = function(column, repetitiveElements) {
        column.fragmentLayoutConstraints.forEach(function(constraint) {
            if (constraint instanceof RepetitiveElementsOwnerLayoutConstraint) {
                var repetitiveElement = constraint.getRepetitiveElements();
                repetitiveElements.push(repetitiveElement);
            }
            if (constraint instanceof vivliostyle.table.TableRowLayoutConstraint) {
                constraint.getElementsOffsetsForTableCell(null).forEach(function(repetitiveElement) {
                    repetitiveElements.push(repetitiveElement);
                });
            }
        });
    };

    /** @override */
    TableFormattingContext.prototype.saveState = function() {
        return [].concat(this.cellBreakPositions);
    };

    /** @override */
    TableFormattingContext.prototype.restoreState = function(state) {
        this.cellBreakPositions =  /** @type {!Array<!vivliostyle.table.BrokenTableCellPosition>}*/ (state);
    };

    /**
     * @param {!Array.<!Array.<!vivliostyle.repetitiveelements.ElementsOffset>>} repeatitiveElementsInColumns
     * @constructor
     * @implements {vivliostyle.repetitiveelements.ElementsOffset}
     */
    vivliostyle.table.ElementsOffsetOfTableCell = function(repeatitiveElementsInColumns) {
        /** @const */ this.repeatitiveElementsInColumns = repeatitiveElementsInColumns;
    };
    /** @const */ var ElementsOffsetOfTableCell = vivliostyle.table.ElementsOffsetOfTableCell;

    /** @override */
    ElementsOffsetOfTableCell.prototype.calculateOffset = function(nodeContext) {
        return this.calculateMaxOffsetOfColumn(nodeContext, function(offsets) {
            return offsets.current;
        });
    };

    /** @override */
    ElementsOffsetOfTableCell.prototype.calculateMinimumOffset = function(nodeContext) {
        return this.calculateMaxOffsetOfColumn(nodeContext, function(offsets) {
            return offsets.minimum;
        });
    };

    /** @private */
    ElementsOffsetOfTableCell.prototype.calculateMaxOffsetOfColumn = function(nodeContext, resolver) {
        var maxOffset = 0;
        this.repeatitiveElementsInColumns.forEach(function(repetitiveElements) {
            var offsets = adapt.layout.calculateOffset(nodeContext, repetitiveElements);
            maxOffset = Math.max(maxOffset, resolver(offsets));
        });
        return maxOffset;
    };

    /**
     * @private
     * @param {adapt.vtree.FormattingContext} formattingContext
     * @returns {!vivliostyle.table.TableFormattingContext}
     */
    function getTableFormattingContext(formattingContext) {
        goog.asserts.assert(formattingContext instanceof TableFormattingContext);
        return /** @type {!vivliostyle.table.TableFormattingContext} */ (formattingContext);
    }

    /**
     * @private
     * @param {?string} display
     * @returns {boolean}
     */
    function isTableRowGrouping(display) {
        return display === "table-row-group" ||
                display === "table-header-group" ||
                display === "table-footer-group";
    }

    /**
     * @private
     * @param {?string} display
     * @returns {boolean}
     */
    function isTableRoot(display) {
        return display === "table" || display === "inline-table";
    }

    /**
     * @private
     * @param {?string} display
     * @returns {boolean}
     */
    function isValidParentOfTableRow(display) {
        return isTableRowGrouping(display) || isTableRoot(display);
    }

    /**
     * @private
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!adapt.layout.Column} column
     * @returns {?adapt.task.Result<boolean>}
     */
    function skipNestedTable(state, formattingContext, column) {
        var nodeContext = state.nodeContext;
        var display = nodeContext.display;
        var parentDisplay = nodeContext.parent ? nodeContext.parent.display : null;
        var isNestedTable =
            (display === "table-row" && !isValidParentOfTableRow(parentDisplay)) ||
            (display === "table-cell" && parentDisplay !== "table-row" && !isValidParentOfTableRow(parentDisplay)) ||
            (nodeContext.formattingContext instanceof TableFormattingContext &&
                nodeContext.formattingContext !== formattingContext);
        if (isNestedTable) {
            return column.buildDeepElementView(nodeContext).thenAsync(function(nodeContextAfter) {
                state.nodeContext = nodeContextAfter;
                return adapt.task.newResult(true);
            });
        } else {
            return null;
        }
    }

    /**
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!adapt.layout.Column} column
     * @constructor
     * @extends {vivliostyle.layoututil.EdgeSkipper}
     */
    vivliostyle.table.EntireTableLayoutStrategy = function(formattingContext, column) {
        /** @const */ this.formattingContext = formattingContext;
        /** @const */ this.column = column;
        /** @type {number} */ this.rowIndex = -1;
        /** @type {number} */ this.columnIndex = 0;
        /** @type {boolean} */ this.inRow = false;
        /** @type {Array.<adapt.vtree.NodeContext>} */ this.checkPoints = [];
    };
    /** @const */ var EntireTableLayoutStrategy = vivliostyle.table.EntireTableLayoutStrategy;
    goog.inherits(EntireTableLayoutStrategy, EdgeSkipper);

    /**
     * @override
     */
    EntireTableLayoutStrategy.prototype.startNonInlineElementNode = function(state) {
        /** @const */ var formattingContext = this.formattingContext;
        var r = skipNestedTable(state, formattingContext, this.column);
        if (r) return r;

        this.postLayoutBlockContents(state);

        /** @const */ var nodeContext = state.nodeContext;
        /** @const */ var display = nodeContext.display;
        var repetitiveElements = formattingContext.getRepetitiveElements();
        switch (display) {
            case "table":
                formattingContext.inlineBorderSpacing = nodeContext.inlineBorderSpacing;
                break;
            case "table-caption":
                var captionView = new TableCaptionView(/** @type {!Element} */ (nodeContext.viewNode),
                    nodeContext.captionSide);
                formattingContext.captions.push(captionView);
                break;
            case "table-header-group":
                if (!repetitiveElements.isHeaderRegistered()) {
                    this.inHeaderOrFooter = true;
                    repetitiveElements.setHeaderNodeContext(nodeContext);
                }
                return adapt.task.newResult(true);
            case "table-footer-group":
                if (!repetitiveElements.isFooterRegistered()) {
                    this.inHeaderOrFooter = true;
                    repetitiveElements.setFooterNodeContext(nodeContext);
                }
                return adapt.task.newResult(true);
            case "table-row":
                if (!this.inHeaderOrFooter) {
                    this.inRow = true;
                    this.rowIndex++;
                    goog.asserts.assert(nodeContext.sourceNode);
                    this.columnIndex = 0;
                    formattingContext.addRow(this.rowIndex, new TableRow(this.rowIndex, nodeContext.sourceNode));
                    if (!repetitiveElements.firstContentSourceNode) {
                        repetitiveElements.firstContentSourceNode = /** @type {!Element} */ (nodeContext.sourceNode);
                    }
                }
                break;
        }
        return EdgeSkipper.prototype.startNonInlineElementNode.call(this, state);
    };

    /**
     * @override
     */
    EntireTableLayoutStrategy.prototype.afterNonInlineElementNode = function(state) {
        /** @const */ var formattingContext = this.formattingContext;
        /** @const */ var nodeContext = state.nodeContext;
        /** @const */ var display = nodeContext.display;
        /** @const */ var clientLayout = this.column.clientLayout;

        this.postLayoutBlockContents(state);

        if (nodeContext.sourceNode === formattingContext.tableSourceNode) {
            var computedStyle = clientLayout.getElementComputedStyle(formattingContext.getRootViewNode(nodeContext));
            formattingContext.tableWidth = parseFloat(computedStyle[formattingContext.vertical ? "height" : "width"]);
            formattingContext.getRepetitiveElements().lastContentSourceNode =
                state.lastAfterNodeContext && state.lastAfterNodeContext.sourceNode;
            state.break = true;
        } else {
            switch (display) {
                case "table-header-group":
                case "table-footer-group":
                    if (this.inHeaderOrFooter) {
                        this.inHeaderOrFooter = false;
                        return adapt.task.newResult(true);
                    }
                    break;
                case "table-row":
                    if (!this.inHeaderOrFooter) {
                        formattingContext.lastRowViewNode = /** @type {!Element} */ (nodeContext.viewNode);
                        this.inRow = false;
                    }
                    break;
                case "table-cell":
                    if (!this.inHeaderOrFooter) {
                        if (!this.inRow) {
                            this.rowIndex++;
                            this.columnIndex = 0;
                            this.inRow = true;
                        }
                        var elem = /** @type {!Element} */ (nodeContext.viewNode);
                        formattingContext.addCell(this.rowIndex, new TableCell(this.rowIndex, this.columnIndex, elem));
                        this.columnIndex++;
                    }
                    break;
            }
        }
        return EdgeSkipper.prototype.afterNonInlineElementNode.call(this, state);
    };

    /** @override */
    EntireTableLayoutStrategy.prototype.startNonElementNode = function(state) {
        this.registerCheckPoint(state);
    };

    /** @override */
    EntireTableLayoutStrategy.prototype.afterNonElementNode = function(state) {
        this.registerCheckPoint(state);
    };

    /** @override */
    EntireTableLayoutStrategy.prototype.startInlineElementNode = function(state) {
        this.registerCheckPoint(state);
    };

    /** @override */
    EntireTableLayoutStrategy.prototype.afterInlineElementNode = function(state) {
        this.registerCheckPoint(state);
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     */
    EntireTableLayoutStrategy.prototype.registerCheckPoint = function(state) {
        var nodeContext = state.nodeContext;
        if (nodeContext && nodeContext.viewNode && !adapt.layout.isSpecialNodeContext(nodeContext)) {
            this.checkPoints.push(nodeContext.clone());
        }
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     */
    EntireTableLayoutStrategy.prototype.postLayoutBlockContents = function(state) {
        if (this.checkPoints.length > 0) {
            this.column.postLayoutBlock(state.nodeContext, this.checkPoints);
        }
        this.checkPoints = [];
    };

    /**
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!adapt.layout.Column} column
     * @constructor
     * @extends {vivliostyle.layoututil.EdgeSkipper}
     */
    vivliostyle.table.TableLayoutStrategy = function(formattingContext, column) {
        EdgeSkipper.call(this, true);
        /** @const */ this.formattingContext = formattingContext;
        /** @const */ this.column = column;
        /** @type {boolean} */ this.inRow = false;

        /** @type {number} */ this.currentRowIndex = -1;
        /** @type {number} */ this.currentColumnIndex = 0;
        /** @type {boolean} */ this.originalStopAtOverflow = column.stopAtOverflow;
        column.stopAtOverflow = false;
    };
    /** @const */ var TableLayoutStrategy = vivliostyle.table.TableLayoutStrategy;
    goog.inherits(TableLayoutStrategy, EdgeSkipper);

    /**
     * @private
     * @const {Object<string, boolean>}
     */
    TableLayoutStrategy.ignoreList = {
        "table-caption": true,
        "table-column-group": true,
        "table-column": true
    };

    TableLayoutStrategy.prototype.resetColumn = function() {
        this.column.stopAtOverflow = this.originalStopAtOverflow;
    };

    /**
     * @param {!vivliostyle.table.TableCell} cell
     * @returns {number}
     */
    TableLayoutStrategy.prototype.getColSpanningCellWidth = function(cell) {
        var colWidths = this.formattingContext.colWidths;
        goog.asserts.assert(colWidths);
        var width = 0;
        for (var i = 0; i < cell.colSpan; i++) {
            width += colWidths[cell.anchorSlot.columnIndex + i];
        }
        width += this.formattingContext.inlineBorderSpacing * (cell.colSpan - 1);
        return width;
    };

    /**
     * @param {!vivliostyle.table.TableCell} cell
     * @param {!adapt.vtree.NodeContext} cellNodeContext
     * @param {!adapt.vtree.ChunkPosition} startChunkPosition
     * @returns {!adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.layoutCell = function(cell, cellNodeContext, startChunkPosition) {
        var rowIndex = cell.rowIndex;
        var columnIndex = cell.columnIndex;
        var colSpan = cell.colSpan;
        var cellViewNode = /** @type {Element} */ (cellNodeContext.viewNode);
        var verticalAlign = cellNodeContext.verticalAlign;

        if (colSpan > 1) {
            adapt.base.setCSSProperty(cellViewNode, "box-sizing", "border-box");
            adapt.base.setCSSProperty(cellViewNode, this.formattingContext.vertical ? "height" : "width",
                this.getColSpanningCellWidth(cell) + "px");
        }

        var pseudoColumnContainer = cellViewNode.ownerDocument.createElement("div");
        cellViewNode.appendChild(pseudoColumnContainer);

        var cellFragment = new TableCellFragment(this.column, pseudoColumnContainer, cellNodeContext);
        this.formattingContext.addCellFragment(rowIndex, columnIndex, cellFragment);

        if (startChunkPosition.primary.steps.length === 1 && startChunkPosition.primary.after) {
            // Contents of the cell have ended in the previous fragment
            cellFragment.empty = true;
        }

        return cellFragment.pseudoColumn.layout(startChunkPosition, true).thenReturn(true);
    };

    /**
     * @returns {boolean}
     */
    TableLayoutStrategy.prototype.hasBrokenCellAtSlot = function(slotIndex) {
        var cellBreakPosition = this.formattingContext.cellBreakPositions[0];
        if (cellBreakPosition) {
            return cellBreakPosition.cell.anchorSlot.columnIndex === slotIndex;
        }
        return false;
    };

    /**
     * @private
     * @returns {!Array<!Array<!vivliostyle.table.BrokenTableCellPosition>>}
     */
    TableLayoutStrategy.prototype.extractRowSpanningCellBreakPositions = function() {
        var cellBreakPositions = this.formattingContext.cellBreakPositions;
        if (cellBreakPositions.length === 0) {
            return [];
        }

        var rowSpanningCellBreakPositions = [];
        var i = 0;
        do {
            var p = cellBreakPositions[i];
            var rowIndex = p.cell.rowIndex;
            if (rowIndex < this.currentRowIndex) {
                var arr = rowSpanningCellBreakPositions[rowIndex];
                if (!arr) {
                    arr = rowSpanningCellBreakPositions[rowIndex] = [];
                }
                arr.push(p);
                cellBreakPositions.splice(i, 1);
            } else {
                i++;
            }
        } while (i < cellBreakPositions.length);
        return rowSpanningCellBreakPositions;
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @returns {!adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.layoutRowSpanningCellsFromPreviousFragment = function(state) {
        var formattingContext = this.formattingContext;
        var rowSpanningCellBreakPositions = this.extractRowSpanningCellBreakPositions();
        var rowCount = rowSpanningCellBreakPositions.reduce(function(s) { return s + 1; }, 0);
        if (rowCount === 0) {
            return adapt.task.newResult(true);
        }

        var layoutContext = this.column.layoutContext;
        var currentRow = state.nodeContext;
        currentRow.viewNode.parentNode.removeChild(currentRow.viewNode);

        var frame = adapt.task.newFrame("layoutRowSpanningCellsFromPreviousFragment");
        var cont = adapt.task.newResult(true);
        var spanningCellRowIndex = 0;
        var occupiedSlotIndices = [];
        rowSpanningCellBreakPositions.forEach(function(rowCellBreakPositions) {
            cont = cont.thenAsync(function() {
                // Is it always correct to assume steps[1] to be the row?
                var rowNodeContext = adapt.vtree.makeNodeContextFromNodePositionStep(
                    rowCellBreakPositions[0].cellNodePosition.steps[1], currentRow.parent);
                return layoutContext.setCurrent(rowNodeContext, false).thenAsync(function() {
                    var cont1 = adapt.task.newResult(true);
                    var columnIndex = 0;

                    function addDummyCellUntil(upperColumnIndex) {
                        while (columnIndex < upperColumnIndex) {
                            if (!(occupiedSlotIndices.indexOf(columnIndex) >= 0)) {
                                var dummy = rowNodeContext.viewNode.ownerDocument.createElement("td");
                                adapt.base.setCSSProperty(dummy, "padding", "0");
                                rowNodeContext.viewNode.appendChild(dummy);
                            }
                            columnIndex++;
                        }
                    }

                    rowCellBreakPositions.forEach(function(cellBreakPosition) {
                        cont1 = cont1.thenAsync(function() {
                            var cell = cellBreakPosition.cell;
                            addDummyCellUntil(cell.anchorSlot.columnIndex);
                            var cellNodePosition = cellBreakPosition.cellNodePosition;
                            var cellNodeContext = adapt.vtree.makeNodeContextFromNodePositionStep(
                                cellNodePosition.steps[0], rowNodeContext);
                            cellNodeContext.offsetInNode = cellNodePosition.offsetInNode;
                            cellNodeContext.after = cellNodePosition.after;
                            cellNodeContext.fragmentIndex = cellNodePosition.steps[0].fragmentIndex+1;
                            return layoutContext.setCurrent(cellNodeContext, false).thenAsync(function() {
                                var breakChunkPosition = cellBreakPosition.breakChunkPosition;
                                for (var i = 0; i < cell.colSpan; i++) {
                                    occupiedSlotIndices.push(columnIndex + i);
                                }
                                columnIndex += cell.colSpan;
                                return this.layoutCell(cell, cellNodeContext, breakChunkPosition).thenAsync(function() {
                                    cellNodeContext.viewNode.rowSpan = cell.rowIndex + cell.rowSpan -
                                        this.currentRowIndex + rowCount - spanningCellRowIndex;
                                    return adapt.task.newResult(true);
                                }.bind(this));
                            }.bind(this));
                        }.bind(this));
                    }, this);
                    return cont1.thenAsync(function() {
                        addDummyCellUntil(formattingContext.getColumnCount());
                        spanningCellRowIndex++;
                        return adapt.task.newResult(true);
                    });
                }.bind(this));
            }.bind(this));
        }, this);
        cont.then(function() {
            layoutContext.setCurrent(currentRow, true, state.atUnforcedBreak).then(function() {
                frame.finish(true);
            });
        });
        return frame.result();
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @return {!adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.startTableRow = function(state) {
        if (this.inHeader || this.inFooter) return adapt.task.newResult(true);
        var nodeContext = state.nodeContext;
        var formattingContext = this.formattingContext;
        if (this.currentRowIndex < 0) {
            goog.asserts.assert(nodeContext.sourceNode);
            this.currentRowIndex = formattingContext.findRowIndexBySourceNode(nodeContext.sourceNode);
        } else {
            this.currentRowIndex++;
        }
        this.currentColumnIndex = 0;
        this.inRow = true;
        return this.layoutRowSpanningCellsFromPreviousFragment(state).thenAsync(function() {
            this.registerCellFragmentIndex();
            var overflown = this.column.checkOverflowAndSaveEdgeAndBreakPosition(state.lastAfterNodeContext, null, true,
                state.breakAtTheEdge);
            if (overflown &&
                formattingContext.getRowSpanningCellsOverflowingTheRow(this.currentRowIndex - 1).length === 0) {
                this.resetColumn();
                nodeContext.overflow = true;
                state.break = true;
            }
            return adapt.task.newResult(true);
        }.bind(this));
    };

    /** @private */
    TableLayoutStrategy.prototype.registerCellFragmentIndex = function() {
        var cells = this.formattingContext.getRowByIndex(this.currentRowIndex).cells;
        cells.forEach(function(cell) {
            var cellBreakPosition = this.formattingContext.cellBreakPositions[cell.columnIndex];
            if (cellBreakPosition && cellBreakPosition.cell.anchorSlot.columnIndex == cell.anchorSlot.columnIndex) {
                var tdNodeStep = cellBreakPosition.cellNodePosition.steps[0];
                var offset = this.column.layoutContext.xmldoc.getElementOffset(tdNodeStep.node);
                vivliostyle.selectors.registerFragmentIndex(offset, tdNodeStep.fragmentIndex+1, 1);
            }
        }.bind(this));
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @return {!adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.startTableCell = function(state) {
        if (this.inHeader || this.inFooter) return adapt.task.newResult(true);
        var nodeContext = state.nodeContext;
        if (!this.inRow) {
            if (this.currentRowIndex < 0) {
                this.currentRowIndex = 0;
            } else {
                this.currentRowIndex++;
            }
            this.currentColumnIndex = 0;
            this.inRow = true;
        }
        var cell = this.formattingContext.getRowByIndex(this.currentRowIndex).cells[this.currentColumnIndex];

        var afterNodeContext = nodeContext.copy().modify();
        afterNodeContext.after = true;
        state.nodeContext = afterNodeContext;

        var frame = adapt.task.newFrame("startTableCell");
        var cont;
        if (this.hasBrokenCellAtSlot(cell.anchorSlot.columnIndex)) {
            var cellBreakPosition = this.formattingContext.cellBreakPositions.shift();
            nodeContext.fragmentIndex = cellBreakPosition.cellNodePosition.steps[0].fragmentIndex+1;
            cont = adapt.task.newResult(cellBreakPosition.breakChunkPosition);
        } else {
            cont = this.column.nextInTree(nodeContext, state.atUnforcedBreak).thenAsync(function(nextNodeContext) {
                if (nextNodeContext.viewNode) {
                    nodeContext.viewNode.removeChild(nextNodeContext.viewNode);
                }
                var startNodePosition = adapt.vtree.newNodePositionFromNodeContext(nextNodeContext, 0);
                return adapt.task.newResult(new adapt.vtree.ChunkPosition(startNodePosition));
            });
        }
        cont.then(function(startChunkPosition) {
            goog.asserts.assert(nodeContext);
            this.layoutCell(cell, nodeContext, startChunkPosition).then(function() {
                this.afterNonInlineElementNode(state);
                this.currentColumnIndex++;
                frame.finish(true);
            }.bind(this));
        }.bind(this));
        return frame.result();
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @return {!adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.startNonInlineBox = function(state) {
        var r = skipNestedTable(state, getTableFormattingContext(this.formattingContext), this.column);
        if (r) return r;

        var nodeContext = state.nodeContext;
        var repetitiveElements = this.formattingContext.getRepetitiveElements();
        var display = nodeContext.display;
        if (display === "table-header-group"
          && repetitiveElements
          && repetitiveElements.isHeaderSourceNode(nodeContext.sourceNode)) {
            this.inHeader = true;
            return adapt.task.newResult(true);
        } else if (display === "table-footer-group"
          && repetitiveElements
          && repetitiveElements.isFooterSourceNode(nodeContext.sourceNode)) {
            this.inFooter = true;
            return adapt.task.newResult(true);
        } else if (display === "table-row") {
            return this.startTableRow(state);
        } else if (display === "table-cell") {
            return this.startTableCell(state);
        } else {
            return adapt.task.newResult(true);
        }
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @return {!adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.endNonInlineBox = function(state) {
        var nodeContext = state.nodeContext;
        var display = nodeContext.display;
        if (display === "table-row") {
            this.inRow = false;
            if (!this.inHeader && !this.inFooter) {
                var beforeNodeContext = nodeContext.copy().modify();
                beforeNodeContext.after = false;
                var bp = new InsideTableRowBreakPosition(this.currentRowIndex,
                    beforeNodeContext, this.formattingContext);
                this.column.breakPositions.push(bp);
            }
        }
        return adapt.task.newResult(true);
    };

    /**
     * @param {!vivliostyle.layoututil.LayoutIteratorState} state
     * @return {undefined|adapt.task.Result<boolean>}
     */
    TableLayoutStrategy.prototype.afterNonInlineElementNode = function(state) {
        var nodeContext = state.nodeContext;
        var repetitiveElements = this.formattingContext.getRepetitiveElements();
        var display = nodeContext.display;
        if (display === "table-header-group") {
            if (repetitiveElements && !repetitiveElements.allowInsertRepeatitiveElements
                && repetitiveElements.isHeaderSourceNode(nodeContext.sourceNode)) {
                this.inHeader = false;
                nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
            } else {
                adapt.base.setCSSProperty(/** @type {!Element} */ (nodeContext.viewNode), "display", "table-row-group");
            }
        } else if (display === "table-footer-group") {
            if (repetitiveElements && !repetitiveElements.allowInsertRepeatitiveElements
                && repetitiveElements.isFooterSourceNode(nodeContext.sourceNode)) {
                this.inFooter = false;
                nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
            } else {
                adapt.base.setCSSProperty(/** @type {!Element} */ (nodeContext.viewNode), "display", "table-row-group");
            }
        }
        if (display && TableLayoutStrategy.ignoreList[display]) {
            nodeContext.viewNode.parentNode.removeChild(nodeContext.viewNode);
        } else if (nodeContext.sourceNode === this.formattingContext.tableSourceNode) {
            nodeContext.overflow = this.column.checkOverflowAndSaveEdge(nodeContext, null);
            this.resetColumn();
            state.break = true;
        } else {
            return EdgeSkipper.prototype.afterNonInlineElementNode.call(this, state);
        }
        return adapt.task.newResult(true);
    };

    /**
     * @typedef {{calculateBreakPositionsInside: boolean}}
     */
    var TableLayoutOption;

    /**
     *  @type {Array<{root: !Node, tableLayoutOption: !TableLayoutOption}>}
     */
    var tableLayoutOptionCache = [];

    /**
     * @param {!Node} tableRootSourceNode
     * @returns {?TableLayoutOption}
     */
    function getTableLayoutOption(tableRootSourceNode) {
        var i = tableLayoutOptionCache.findIndex(function(c) {
            return c.root === tableRootSourceNode;
        });
        var pair = tableLayoutOptionCache[i];
        return pair ? pair.tableLayoutOption : null;
    }

    /**
     * @param {!Node} tableRootSourceNode
     */
    function clearTableLayoutOptionCache(tableRootSourceNode) {
        var i = tableLayoutOptionCache.findIndex(function(c) {
            return c.root === tableRootSourceNode;
        });
        if (i >= 0)
            tableLayoutOptionCache.splice(i, 1);
    }

    /**
     * @constructor
     * @implements {adapt.layout.LayoutProcessor}
     */
    vivliostyle.table.TableLayoutProcessor = function() {};
    /** @const */ var TableLayoutProcessor = vivliostyle.table.TableLayoutProcessor;

    /**
     * @private
     * @param {adapt.vtree.NodeContext} nodeContext
     * @param {!adapt.layout.Column} column
     * @returns {!adapt.task.Result.<adapt.vtree.NodeContext>}
     */
    TableLayoutProcessor.prototype.layoutEntireTable = function(nodeContext, column) {
        /** @const */ var formattingContext = getTableFormattingContext(nodeContext.formattingContext);
        /** @const */ var strategy = new EntireTableLayoutStrategy(formattingContext, column);
        /** @const */ var iterator = new LayoutIterator(strategy, column.layoutContext);
        return iterator.iterate(nodeContext);
    };

    /**
     * @private
     * @param {!Element} lastRow
     * @param {number} columnCount
     * @param {boolean} vertical
     * @param {adapt.vtree.ClientLayout} clientLayout
     * @returns {!Array<number>}
     */
    TableLayoutProcessor.prototype.getColumnWidths = function(lastRow, columnCount, vertical, clientLayout) {
        /** @const */ var doc = lastRow.ownerDocument;
        /** @const */ var dummyRow = doc.createElement("tr");
        /** @const */ var dummyCells = [];
        for (var i = 0; i < columnCount; i++) {
            var cell = doc.createElement("td");
            dummyRow.appendChild(cell);
            dummyCells.push(cell);
        }
        lastRow.parentNode.insertBefore(dummyRow, lastRow.nextSibling);
        /** @const */ var colWidths = dummyCells.map(function(cell) {
            var rect = clientLayout.getElementClientRect(cell);
            return vertical ? rect["height"] : rect["width"];
        });
        lastRow.parentNode.removeChild(dummyRow);
        return colWidths;
    };

    /**
     * @private
     * @param {!Element} tableElement
     * @returns {!Array<!Element>}
     */
    TableLayoutProcessor.prototype.getColGroupElements = function(tableElement) {
        var colGroups = [];
        var child = tableElement.firstElementChild;
        while (child) {
            if (child.localName === "colgroup") {
                colGroups.push(child);
            }
            child = child.nextElementSibling;
        }
        return colGroups;
    };

    /**
     * @private
     * @param {!Array<!Element>} colGroups
     * @returns {!Array<!Element>}
     */
    TableLayoutProcessor.prototype.normalizeAndGetColElements = function(colGroups) {
        var cols = [];
        colGroups.forEach(function(colGroup) {
            // Replace colgroup[span=n] with colgroup with n col elements
            var span = colGroup.span;
            colGroup.removeAttribute("span");
            var col = colGroup.firstElementChild;
            while (col) {
                if (col.localName === "col") {
                    // Replace col[span=n] with n col elements
                    var s = col.span;
                    col.removeAttribute("span");
                    span -= s;
                    while (s-- > 1) {
                        var cloned = col.cloneNode(true);
                        colGroup.insertBefore(cloned, col);
                        cols.push(cloned);
                    }
                    cols.push(col);
                }
                col = col.nextElementSibling;
            }
            while (span-- > 0) {
                col = colGroup.ownerDocument.createElement("col");
                colGroup.appendChild(col);
                cols.push(col);
            }
        });
        return cols;
    };

    /**
     * @private
     * @param {!Array<!Element>} cols
     * @param {!Array<!Element>} colGroups
     * @param {number} columnCount
     * @param {!Element} tableElement
     */
    TableLayoutProcessor.prototype.addMissingColElements = function(cols, colGroups, columnCount, tableElement) {
        if (cols.length < columnCount) {
            var colGroup = tableElement.ownerDocument.createElement("colgroup");
            colGroups.push(colGroup);
            for (var i = cols.length; i < columnCount; i++) {
                var col = tableElement.ownerDocument.createElement("col");
                colGroup.appendChild(col);
                cols.push(col);
            }
        }
    };

    /**
     * Measure width of columns and normalize colgroup and col elements so that each column has
     * a corresponding col element with the width specified.
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!Element} tableElement
     * @param {!adapt.layout.Column} column
     */
    TableLayoutProcessor.prototype.normalizeColGroups = function(formattingContext, tableElement, column) {
        /** @const */ var vertical = formattingContext.vertical;
        /** @const */ var lastRow = formattingContext.lastRowViewNode;
        if (!lastRow) return;
        goog.asserts.assert(lastRow);
        formattingContext.lastRowViewNode = null;
        /** @const */ var doc = lastRow.ownerDocument;
        /** @const */ var fragment = doc.createDocumentFragment();

        // Count columns
        /** @const */ var columnCount = formattingContext.getColumnCount();
        if (!(columnCount > 0)) {
            formattingContext.colGroups = fragment;
            return;
        }

        // Measure column widths
        /** @const */ var colWidths = formattingContext.colWidths =
            this.getColumnWidths(lastRow, columnCount, vertical, column.clientLayout);

        // Normalize colgroup and col elements
        /** @const */ var colGroups = this.getColGroupElements(tableElement);
        /** @const */ var cols = this.normalizeAndGetColElements(colGroups);

        // Add missing col elements for remaining columns
        this.addMissingColElements(cols, colGroups, columnCount, tableElement);

        // Assign width to col elements
        cols.forEach(function(col, i) {
            adapt.base.setCSSProperty(col, vertical ? "height" : "width", colWidths[i] + "px");
        });

        colGroups.forEach(function(colGroup) {
            fragment.appendChild(colGroup.cloneNode(true));
        });
        formattingContext.colGroups = fragment;
    };

    /**
     * @param {!adapt.vtree.NodeContext} nodeContext
     * @param {!adapt.layout.Column} column
     * @returns {!adapt.task.Result.<adapt.vtree.NodeContext>}
     */
    TableLayoutProcessor.prototype.doInitialLayout = function(nodeContext, column) {
        var formattingContext = getTableFormattingContext(nodeContext.formattingContext);
        formattingContext.vertical = nodeContext.vertical;
        formattingContext.initializeRepetitiveElements(nodeContext.vertical);
        goog.asserts.assert(nodeContext.sourceNode);
        var tableLayoutOption = getTableLayoutOption(nodeContext.sourceNode);
        clearTableLayoutOptionCache(nodeContext.sourceNode);
        var frame = adapt.task.newFrame("TableLayoutProcessor.doInitialLayout");
        var initialNodeContext = nodeContext.copy();
        this.layoutEntireTable(nodeContext, column).then(function(nodeContextAfter) {
            var tableElement = nodeContextAfter.viewNode;
            var tableBBox = column.clientLayout.getElementClientRect(tableElement);
            var edge = column.vertical ? tableBBox.left : tableBBox.bottom;
            edge += (column.vertical ? -1 : 1) * adapt.layout.calculateOffset(
                nodeContext, vivliostyle.repetitiveelements.collectElementsOffset(column)).current;
            if (!column.isOverflown(edge) &&
                (!tableLayoutOption || !tableLayoutOption.calculateBreakPositionsInside)) {
                column.breakPositions.push(new EntireTableBreakPosition(initialNodeContext));
                frame.finish(nodeContextAfter);
                return;
            }
            this.normalizeColGroups(formattingContext, tableElement, column);
            formattingContext.updateCellSizes(column.clientLayout);
            frame.finish(null);
        }.bind(this));
        return frame.result();
    };

    /**
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!Element} rootViewNode
     * @param {?Node} firstChild
     */
    TableLayoutProcessor.prototype.addCaptions = function(formattingContext, rootViewNode, firstChild) {
        var captions = formattingContext.captions;
        captions.forEach(function(caption, i) {
            if (caption) {
                rootViewNode.insertBefore(caption.viewNode, firstChild);
                if (caption.side === "top") {
                    captions[i] = null;
                }
            }
        });
    };

    /**
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!Element} rootViewNode
     * @param {?Node} firstChild
     */
    TableLayoutProcessor.prototype.addColGroups = function(formattingContext, rootViewNode, firstChild) {
        if (formattingContext.colGroups && this.getColGroupElements(rootViewNode).length === 0) {
            rootViewNode.insertBefore(formattingContext.colGroups.cloneNode(true), firstChild);
        }
    };

    /**
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {Element} rootViewNode
     */
    TableLayoutProcessor.prototype.removeColGroups = function(formattingContext, rootViewNode) {
        if (formattingContext.colGroups && rootViewNode) {
            var colGroups = this.getColGroupElements(rootViewNode);
            if (colGroups) {
                colGroups.forEach(function(colGroup) {
                    rootViewNode.removeChild(colGroup);
                });
            }
        }
    };

    /**
     * @param {!adapt.vtree.NodeContext} nodeContext
     * @param {!adapt.layout.Column} column
     * @returns {!adapt.task.Result.<adapt.vtree.NodeContext>}
     */
    TableLayoutProcessor.prototype.doLayout = function(nodeContext, column) {
        var formattingContext = getTableFormattingContext(nodeContext.formattingContext);
        var rootViewNode = formattingContext.getRootViewNode(nodeContext);
        var firstChild = rootViewNode.firstChild;
        this.addCaptions(formattingContext, rootViewNode, firstChild);
        this.addColGroups(formattingContext, rootViewNode, firstChild);

        var strategy = new TableLayoutStrategy(formattingContext, column);
        var iterator = new LayoutIterator(strategy, column.layoutContext);
        var frame = adapt.task.newFrame("TableFormattingContext.doLayout");
        iterator.iterate(nodeContext).thenFinish(frame);
        return frame.result();
    };

    /**
     * @override
     */
    TableLayoutProcessor.prototype.layout = function(nodeContext, column, leadingEdge) {
        var formattingContext = getTableFormattingContext(nodeContext.formattingContext);
        var rootViewNode = formattingContext.getRootViewNode(nodeContext);
        if (!rootViewNode) {
            return column.buildDeepElementView(nodeContext);
        } else {
            if (leadingEdge) vivliostyle.repetitiveelements.appendHeaderToAncestors(nodeContext.parent, column);
            return new LayoutRetryer(formattingContext, this).layout(nodeContext, column);
        }
    };

    /**
     * @override
     */
    TableLayoutProcessor.prototype.createEdgeBreakPosition = function(position,
        breakOnEdge, overflows, columnBlockSize) {
        return new BetweenTableRowBreakPosition(position, breakOnEdge, overflows, columnBlockSize);
    };

    /**
     * @override
     */
    TableLayoutProcessor.prototype.startNonInlineElementNode = function(nodeContext) {
        return false;
    };
    /**
     * @override
     */
    TableLayoutProcessor.prototype.afterNonInlineElementNode = function(nodeContext) {
        return false;
    };


    /**
     * @override
     */
    TableLayoutProcessor.prototype.finishBreak = function(column, nodeContext, forceRemoveSelf, endOfColumn) {
        var formattingContext = getTableFormattingContext(nodeContext.formattingContext);

        if (nodeContext.display === "table-row") {
            goog.asserts.assert(nodeContext.sourceNode);
            var rowIndex = formattingContext.findRowIndexBySourceNode(nodeContext.sourceNode);
            formattingContext.cellBreakPositions = [];

            var cells;
            if (!nodeContext.after) {
                cells = formattingContext.getCellsFallingOnRow(rowIndex);
            } else {
                cells = formattingContext.getRowSpanningCellsOverflowingTheRow(rowIndex);
            }
            if (cells.length) {
                var frame = adapt.task.newFrame("TableLayoutProcessor.finishBreak");
                var i = 0;
                frame.loopWithFrame(function(loopFrame) {
                    if (i === cells.length) {
                        loopFrame.breakLoop();
                        return;
                    }
                    var cell = cells[i++];
                    var cellFragment = formattingContext.getCellFragmentOfCell(cell);
                    var breakNodeContext = cellFragment.findAcceptableBreakPosition().nodeContext;
                    goog.asserts.assert(breakNodeContext);
                    var cellNodeContext = cellFragment.cellNodeContext;
                    var cellNodePosition = cellNodeContext.toNodePosition();
                    var breakChunkPosition = new adapt.vtree.ChunkPosition(breakNodeContext.toNodePosition());
                    formattingContext.cellBreakPositions.push(
                        /** @type {vivliostyle.table.BrokenTableCellPosition} */ ({
                            cellNodePosition: cellNodePosition,
                            breakChunkPosition: breakChunkPosition,
                            cell: cell
                        })
                    );
                    var cellViewNode = /** @type {Element} */ (cellNodeContext.viewNode);
                    cellFragment.column.layoutContext.processFragmentedBlockEdge(cellFragment.cellNodeContext);
                    if (rowIndex < cell.rowIndex + cell.rowSpan - 1) {
                        cellViewNode.rowSpan = rowIndex - cell.rowIndex + 1;
                    }
                    if (!cellFragment.empty) {
                        cellFragment.pseudoColumn.finishBreak(breakNodeContext, false, true).then(function() {
                            goog.asserts.assert(cellFragment);
                            adjustCellHeight(cellFragment, formattingContext, breakNodeContext);
                            loopFrame.continueLoop();
                        });
                    } else {
                        loopFrame.continueLoop();
                    }
                }).then(function() {
                    column.clearOverflownViewNodes(nodeContext, false);
                    column.layoutContext.processFragmentedBlockEdge(nodeContext);
                    formattingContext.finishFragment();
                    frame.finish(true);
                });
                return frame.result();
            }
        }
        formattingContext.finishFragment();
        return adapt.layout.blockLayoutProcessor.finishBreak(
            column, nodeContext, forceRemoveSelf, endOfColumn);
    };

    /** @override */
    TableLayoutProcessor.prototype.clearOverflownViewNodes = function(column, parentNodeContext, nodeContext, removeSelf) {
        adapt.layout.BlockLayoutProcessor.prototype.clearOverflownViewNodes(column, parentNodeContext, nodeContext, removeSelf);
    };

    /**
     * @param {!vivliostyle.table.TableCellFragment} cellFragment
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {adapt.vtree.NodeContext} breakNodeContext
     */
    function adjustCellHeight(cellFragment, formattingContext, breakNodeContext) {
        var repetitiveElements = formattingContext.getRepetitiveElements();
        if (!repetitiveElements) return;

        var vertical = formattingContext.vertical;
        var column = cellFragment.column;
        var cellContentElement = cellFragment.pseudoColumn.getColumnElement();
        var cellElement = /** @type {Element} */ (cellFragment.cellNodeContext.viewNode);

        var cellElementRect = column.clientLayout.getElementClientRect(cellElement);
        var padding = column.getComputedPaddingBorder(cellElement);
        if (vertical) {
            var width = (cellElementRect.right - column.footnoteEdge - repetitiveElements.calculateOffset(breakNodeContext) - padding.right);
            adapt.base.setCSSProperty(cellContentElement, "max-width", width + "px");
        } else {
            var height = (column.footnoteEdge - repetitiveElements.calculateOffset(breakNodeContext) - cellElementRect.top - padding.top);
            adapt.base.setCSSProperty(cellContentElement, "max-height", height + "px");
        }
        adapt.base.setCSSProperty(cellContentElement, "overflow", "hidden");
    }

    /**
     * @constructor
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!vivliostyle.table.TableLayoutProcessor} processor
     * @extends {vivliostyle.layoututil.AbstractLayoutRetryer}
     */
    vivliostyle.table.LayoutRetryer = function(formattingContext, processor) {
        AbstractLayoutRetryer.call(this);
        /** @private @const */ this.processor = processor;
        /** @private @const */ this.tableFormattingContext = formattingContext;
    };
    /** @const */ var LayoutRetryer = vivliostyle.table.LayoutRetryer;
    goog.inherits(LayoutRetryer, AbstractLayoutRetryer);

    /**
     * @override
     */
    LayoutRetryer.prototype.resolveLayoutMode = function(nodeContext) {
        var repetitiveElements = this.tableFormattingContext.getRepetitiveElements();
        if (!repetitiveElements || !repetitiveElements.doneInitialLayout) {
            return new LayoutEntireTable(this.tableFormattingContext, this.processor);
        } else {
            if (nodeContext.sourceNode === this.tableFormattingContext.tableSourceNode && !nodeContext.after) {
                if (repetitiveElements) repetitiveElements.preventSkippingHeader();
            }
            return new LayoutFragmentedTable(this.tableFormattingContext, this.processor);
        }
    };

    /**
     * @override
     */
    LayoutRetryer.prototype.clearNodes = function(initialPosition) {
        AbstractLayoutRetryer.prototype.clearNodes.call(this, initialPosition);
        var rootViewNode = this.tableFormattingContext.getRootViewNode(initialPosition);
        this.processor.removeColGroups(this.tableFormattingContext, rootViewNode);
    };

    /**
     * @override
     */
    LayoutRetryer.prototype.restoreState = function(nodeContext, column) {
        AbstractLayoutRetryer.prototype.restoreState.call(this, nodeContext, column);
        this.tableFormattingContext.finishFragment();
    };

    /**
     * @constructor
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!vivliostyle.table.TableLayoutProcessor} processor
     * @extends {vivliostyle.repetitiveelements.LayoutEntireBlock}
     */
    vivliostyle.table.LayoutEntireTable = function(formattingContext, processor) {
        LayoutEntireBlock.call(this, formattingContext);
        /** @const */ this.processor = processor;
    };
    /** @const */ var LayoutEntireTable = vivliostyle.table.LayoutEntireTable;
    goog.inherits(LayoutEntireTable, LayoutEntireBlock);

    /**
     * @override
     */
    LayoutEntireTable.prototype.doLayout = function(nodeContext, column) {
        LayoutEntireBlock.prototype.doLayout.call(this, nodeContext, column);
        return this.processor.doInitialLayout(nodeContext, column);
    };

    /**
     * @constructor
     * @param {!adapt.vtree.NodeContext} tableNodeContext
     * @extends {adapt.layout.EdgeBreakPosition}
     */
    vivliostyle.table.EntireTableBreakPosition = function(tableNodeContext) {
        adapt.layout.EdgeBreakPosition.call(this, tableNodeContext, null, tableNodeContext.overflow, 0);
    };
    /** @const */ var EntireTableBreakPosition = vivliostyle.table.EntireTableBreakPosition;
    goog.inherits(EntireTableBreakPosition, adapt.layout.EdgeBreakPosition);

    /**
     * @override
     */
    EntireTableBreakPosition.prototype.getMinBreakPenalty = function() {
        if (!this.isEdgeUpdated) {
            throw new Error("EdgeBreakPosition.prototype.updateEdge not called");
        }
        return (this.overflows ? 3 : 0)
            + (this.position.parent ? this.position.parent.breakPenalty : 0);
    };

    /**
     * @override
     */
    EntireTableBreakPosition.prototype.breakPositionChosen = function(column) {
        column.fragmentLayoutConstraints.push(
            new EntireTableLayoutConstraint(this.position.sourceNode));
    };

    /**
     * @constructor
     * @param {Node} tableRootNode
     * @implements {adapt.layout.FragmentLayoutConstraint}
     */
    vivliostyle.table.EntireTableLayoutConstraint = function(tableRootNode) {
        this.tableRootNode = tableRootNode;
    };
    /** @const */ var EntireTableLayoutConstraint = vivliostyle.table.EntireTableLayoutConstraint;

    /**
     * @override
     */
    EntireTableLayoutConstraint.prototype.allowLayout = function(nodeContext, overflownNodeContext, column) {
        // If the nodeContext overflows, any EntireTableLayoutConstraint should not be registered in the first place.
        // See TableLayoutProcessor.prototype.doInitialLayout.
        goog.asserts.assert(!nodeContext.overflow);
        return false;
    };

    /**
     * @override
     */
    EntireTableLayoutConstraint.prototype.nextCandidate = function(nodeContext) {
        return true;
    };

    /**
     * @override
     */
    EntireTableLayoutConstraint.prototype.postLayout = function(allowed, positionAfter, initialPosition, column) {
        goog.asserts.assert(positionAfter.sourceNode);
        tableLayoutOptionCache.push({
            root: positionAfter.sourceNode,
            tableLayoutOption: /** @type {!TableLayoutOption} */({calculateBreakPositionsInside: true})
        });
    };

    /**
     * @override
     */
    EntireTableLayoutConstraint.prototype.finishBreak = function(nodeContext, column) {
        return adapt.task.newResult(true);
    };

    /**
     * @override
     */
    EntireTableLayoutConstraint.prototype.equalsTo = function(constraint) {
        return (constraint instanceof EntireTableLayoutConstraint) &&
            constraint.tableRootNode === this.tableRootNode;
    };

    /**
     * @override
     */
    EntireTableLayoutConstraint.prototype.getPriorityOfFinishBreak = function() {
        return 0;
    };

    /**
     * @constructor
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @param {!vivliostyle.table.TableLayoutProcessor} processor
     * @extends {vivliostyle.repetitiveelements.LayoutFragmentedBlock}
     */
    vivliostyle.table.LayoutFragmentedTable = function(formattingContext, processor) {
        LayoutFragmentedBlock.call(this, formattingContext);
        /** @const */ this.processor = processor;
    };
    /** @const */ var LayoutFragmentedTable = vivliostyle.table.LayoutFragmentedTable;
    goog.inherits(LayoutFragmentedTable, LayoutFragmentedBlock);

    /**
     * @override
     */
    LayoutFragmentedTable.prototype.doLayout = function(nodeContext, column) {
        var repetitiveElements = this.formattingContext.getRepetitiveElements();
        if (repetitiveElements && !repetitiveElements.isAfterLastContent(nodeContext)) {
            var constraint = new TableRowLayoutConstraint(nodeContext);
            if (!column.fragmentLayoutConstraints.some(function(c) { return constraint.equalsTo(c); })) {
                column.fragmentLayoutConstraints.unshift(constraint);
            }
        }
        return this.processor.doLayout(nodeContext, column);
    };


    /**
     * @constructor
     * @param {!adapt.vtree.NodeContext} nodeContext
     * @extends {vivliostyle.repetitiveelements.RepetitiveElementsOwnerLayoutConstraint}
     */
    vivliostyle.table.TableRowLayoutConstraint = function(nodeContext) {
        RepetitiveElementsOwnerLayoutConstraint.call(this, nodeContext);

        /** @type {Array.<{constraints: Array.<adapt.layout.FragmentLayoutConstraint>, breakPosition:adapt.vtree.NodeContext}>} */
        this.cellFragmentLayoutConstraints = [];
    };
    /** @const */ var TableRowLayoutConstraint = vivliostyle.table.TableRowLayoutConstraint;
    goog.inherits(TableRowLayoutConstraint, RepetitiveElementsOwnerLayoutConstraint);

    /** @override */
    TableRowLayoutConstraint.prototype.allowLayout = function(nodeContext, overflownNodeContext, column) {
        var repetitiveElements = this.getRepetitiveElements();
        if (!repetitiveElements) return true;

        if (column.pseudoParent) return true;
        if (adapt.layout.isOrphan(this.nodeContext.viewNode)) return true;
        if (!repetitiveElements.isEnableToUpdateState()) return true;

        if ((overflownNodeContext && !nodeContext)
          || (nodeContext && nodeContext.overflow)) {
            return false;
        } else {
            return true;
        }
    };


    /** @override */
    TableRowLayoutConstraint.prototype.nextCandidate = function(nodeContext) {
        var formattingContext = getTableFormattingContext(this.nodeContext.formattingContext);
        var cellFragmentConstraints = this.collectCellFragmentLayoutConstraints(nodeContext, formattingContext);
        if (cellFragmentConstraints.some(function(entry) {
            return entry.constraints.some(function(constraint) {
                return constraint.nextCandidate(nodeContext);
            });
        })) {
            return true;
        }
        return RepetitiveElementsOwnerLayoutConstraint.prototype.nextCandidate.call(this, nodeContext);
    };

    /** @override */
    TableRowLayoutConstraint.prototype.postLayout = function(allowed, nodeContext, initialPosition, column) {
        var formattingContext = getTableFormattingContext(this.nodeContext.formattingContext);
        this.cellFragmentLayoutConstraints = this.collectCellFragmentLayoutConstraints(nodeContext, formattingContext);
        this.cellFragmentLayoutConstraints.forEach(function(entry) {
            entry.constraints.forEach(function(constraint) {
                constraint.postLayout(allowed, entry.breakPosition, initialPosition, column);
            });
        });

        if (!allowed) {
            var rootViewNode = formattingContext.getRootViewNode(this.nodeContext);
            new vivliostyle.table.TableLayoutProcessor().removeColGroups(formattingContext, rootViewNode);
            this.removeDummyRowNodes(initialPosition);
        }
        RepetitiveElementsOwnerLayoutConstraint.prototype.postLayout.call(this, allowed, nodeContext, initialPosition, column);
    };


    /** @override */
    TableRowLayoutConstraint.prototype.finishBreak = function(nodeContext, column) {
        var formattingContext = getTableFormattingContext(this.nodeContext.formattingContext);
        /** @type {!adapt.task.Frame.<boolean>} */ var frame = adapt.task.newFrame("finishBreak");
        var constraints = this.cellFragmentLayoutConstraints.reduce(function(array, entry) {
            return array.concat(entry.constraints.map(function(constraint) {
                return { constraint: constraint, breakPosition: entry.breakPosition };
            }));
        }, []);
        var i=0;
        frame.loop(function() {
            if (i < constraints.length) {
                var entry = constraints[i++];
                return entry.constraint.finishBreak(entry.breakPosition, column).thenReturn(true);
            } else {
                return adapt.task.newResult(false);
            }
        }).then(function() {
            frame.finish(true);
        });
        return frame.result().thenAsync(function() {
            return RepetitiveElementsOwnerLayoutConstraint.prototype.finishBreak.call(this, nodeContext, column);
        }.bind(this));
    };

    TableRowLayoutConstraint.prototype.removeDummyRowNodes = function(nodeContext) {
        if (!nodeContext || nodeContext.display !== "table-row" || !nodeContext.viewNode) return;

        while (nodeContext.viewNode.previousElementSibling) {
            var dummyNode = nodeContext.viewNode.previousElementSibling;
            if (dummyNode.parentNode) dummyNode.parentNode.removeChild(dummyNode);
        }
    };

    /**
     * @private
     * @param {adapt.vtree.NodeContext} nodeContext
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @return {Array.<{constraints: Array.<adapt.layout.FragmentLayoutConstraint>, breakPosition:adapt.vtree.NodeContext}>}
     */
    TableRowLayoutConstraint.prototype.collectCellFragmentLayoutConstraints = function(nodeContext, formattingContext) {
        return this.getCellFragemnts(nodeContext, formattingContext).map(function(entry) {
            return {
                constraints: entry.fragment.pseudoColumn.getColumn().fragmentLayoutConstraints,
                breakPosition: entry.breakPosition
            };
        });
    };

    /**
     * @private
     * @param {adapt.vtree.NodeContext} nodeContext
     * @param {!vivliostyle.table.TableFormattingContext} formattingContext
     * @return {Array.<{fragment: vivliostyle.table.TableCellFragment, breakPosition:adapt.vtree.NodeContext}>}
     */
    TableRowLayoutConstraint.prototype.getCellFragemnts = function(nodeContext, formattingContext) {
        var rowIndex = Number.MAX_VALUE;
        if (nodeContext && nodeContext.display === "table-row") {
            goog.asserts.assert(nodeContext.sourceNode);
            rowIndex = formattingContext.findRowIndexBySourceNode(nodeContext.sourceNode)+1;
        }
        rowIndex = Math.min(formattingContext.cellFragments.length, rowIndex);
        var cellFragments = [];
        for (var i=0; i < rowIndex; i++) {
            if (!formattingContext.cellFragments[i]) continue;
            formattingContext.cellFragments[i].forEach(function(cellFragment) {
                if (!cellFragment) return;
                cellFragments.push({
                    fragment: cellFragment,
                    breakPosition: cellFragment.findAcceptableBreakPosition().nodeContext
                });
            });
        }
        return cellFragments;
    };

    /**
     * @param {adapt.layout.Column} column
     * @return {Array.<!vivliostyle.repetitiveelements.ElementsOffset>}
     */
    TableRowLayoutConstraint.prototype.getElementsOffsetsForTableCell = function(column) {
        var formattingContext = getTableFormattingContext(this.nodeContext.formattingContext);
        var position = formattingContext.findCellFromColumn(column);
        if (position) {
            return formattingContext.collectElementsOffsetOfUpperCells(position);
        } else {
            return formattingContext.collectElementsOffsetOfHighestColumn();
        }
    };

    /** @override */
    TableRowLayoutConstraint.prototype.equalsTo = function(constraint) {
        if (!(constraint instanceof TableRowLayoutConstraint)) return false;
        return getTableFormattingContext(this.nodeContext.formattingContext)
           === getTableFormattingContext(constraint.nodeContext.formattingContext);
    };

    /**
     * @const
     */
    var tableLayoutProcessor = new TableLayoutProcessor();

    /**
     * @type {vivliostyle.plugin.ResolveFormattingContextHook}
     */
    function resolveFormattingContextHook(nodeContext, firstTime, display, position, floatSide, isRoot) {
        if (!firstTime)
            return null;
        if (display === adapt.css.ident.table) {
            var parent = nodeContext.parent;
            return new TableFormattingContext(parent ? parent.formattingContext : null,
                /** @type {!Element} */ (nodeContext.sourceNode));
        }
        return null;
    }

    /**
     * @type {vivliostyle.plugin.ResolveLayoutProcessorHook}
     */
    function resolveLayoutProcessor(formattingContext) {
        if (formattingContext instanceof TableFormattingContext) {
            return tableLayoutProcessor;
        }
        return null;
    }

    function registerHooks() {
        var plugin = vivliostyle.plugin;
        plugin.registerHook(plugin.HOOKS.RESOLVE_FORMATTING_CONTEXT,
            resolveFormattingContextHook);
        plugin.registerHook(plugin.HOOKS.RESOLVE_LAYOUT_PROCESSOR,
            resolveLayoutProcessor);
    }

    registerHooks();
});
