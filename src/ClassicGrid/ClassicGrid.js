// @flow
/* eslint react/no-find-dom-node: 0 */
import React, { Component } from 'react';
import ReactDOM from 'react-dom';
import styles from './Grid.css';
import WithLayout from './WithLayout';

type Props<T> = {|
  columnWidth: number,
  comp: () => void,
  gutterWidth: number,
  items: T[],
  minCols: number,
  loadItems: () => void,
  scrollContainer: HTMLElement,
|};

export default class ClassicGrid extends Component {
  static defaultProps: {};

  constructor(props: Props<*>) {
    super(props);

    this.currColHeights = [];
    this.setCacheKey();
    this.gridWrapperHeight = 0;

    this.state = {
      layoutReady: false,
      containerWidth: '100%',
    };
  }

  state: {
    containerWidth: number | string,
    layoutReady: bool
  };

  /**
   * Adds hooks after the component mounts.
   */
  componentDidMount() {
    // We calculate columns and offset after the component mounts so we can measure our container.
    this.reflow(this.calculateColumns());

    this.boundResizeHandler = () => this.handleResize();

    this.props.scrollContainer.addEventListener('scroll', this.handleScroll);
    this.props.scrollContainer.addEventListener('resize', this.boundResizeHandler);

    // Since items are positioned absolutely, we can't rely on margin or padding to center
    // an arbitrary number of columns. Calculate the width in order to center the grid.
    this.gridWrapper.style.width = this.determineWidth();

    /* eslint react/no-did-mount-set-state:0 */
    this.setState({
      layoutReady: true,
    });
  }

  /**
   * Sets the height of the grid after the component updates.
   * This allows stacking of items under the grid due to absolutely positioned elements.
   */
  componentDidUpdate() {
    setTimeout(() => {
      const longestColumn = Math.max.apply(null, this.currColHeights);
      if (this.gridWrapperHeight !== longestColumn) {
        this.gridWrapperHeight = longestColumn;
        this.gridWrapper.style.height = `${longestColumn}px`;
        this.scrollBuffer = this.getContainerHeight() * 2;
        this.handleScroll();
      }
    });
  }

  /**
   * Remove listeners when unmounting.
   */
  componentWillUnmount() {
    this.props.scrollContainer.removeEventListener('scroll', this.handleScroll);
    this.props.scrollContainer.removeEventListener('resize', this.boundResizeHandler);
  }

  /**
   * Returns the container height.
   */
  getContainerHeight() {
    const container = this.props.scrollContainer;
    return container.clientHeight || container.innerHeight;
  }

  /**
   * Returns the scroll position of the scroll container.
   */
  getScrollPos() {
    // Try accessing scrollY, as the grid will generally be scrolled by the window.
    const el = this.props.scrollContainer;
    return el.scrollY !== undefined ? el.scrollY : el.scrollTop;
  }

  /**
   * Sets a cache key based on the number of columns and a timestamp.
   * This is consumed by the WithLayout component to cache grid item layout.
   */
  setCacheKey() {
    this.cacheKey = `${this.currColHeights.length} - ${Date.now()}`;
  }

  boundResizeHandler: () => void;
  cacheKey: string;
  currColHeights: Array<number>;
  fetchingWith: bool | number;
  gridWrapper: HTMLElement;
  gridWrapperHeight: number;
  resizeTimeout: ?number;
  scrollBuffer: number;

  /**
   * Delays resize handling in case the scroll container is still being resized.
   */
  handleResize() {
    if (this.resizeTimeout) {
      clearTimeout(this.resizeTimeout);
      this.resizeTimeout = null;
    }
    this.resizeTimeout = setTimeout(this.reflowIfNeeded.bind(this), 100);
  }

  /**
   * Resets the local cache.
   */
  reflow(columnCount: number) {
    const columnCountOutput = columnCount || this.calculateColumns();

    // Sets the columns heights as an array, each member corresponding to a column.
    if (typeof document === 'undefined') {
      this.currColHeights = [];
    } else {
      this.currColHeights = new (self.Uint32Array || self.Array)(columnCountOutput);
    }
    this.setCacheKey();

    // Whether or not we have requested new items.
    // This is used as a flag to signal that we need to wait before loading additional items.
    this.fetchingWith = false;
    this.forceUpdate();
  }

  /**
   * Determines the number of columns to display.
   */
  calculateColumns() {
    if (!this.props.scrollContainer) {
      return 0;
    }

    const eachItemWidth = this.props.columnWidth + this.props.gutterWidth;
    /* eslint react/no-find-dom-node: 0 */
    const parentNode = ReactDOM.findDOMNode(this).parentNode;
    const parentWidth = parentNode.clientWidth;

    let newColCount = Math.floor(parentWidth / eachItemWidth);

    if (newColCount < this.props.minCols) {
      newColCount = this.props.minCols;
    }
    return newColCount;
  }

  /**
   * Reflows items if needed after a resize.
   * We need to reflow items if the number of columns we would display should change.
   */
  reflowIfNeeded() {
    const newColCount = this.calculateColumns();
    const containerWidth = this.determineWidth();

    if (newColCount !== this.currColHeights.length
      || this.state.containerWidth !== containerWidth) {
      this.reflow(newColCount);
      this.gridWrapper.style.width = this.determineWidth();
      this.forceUpdate();
      return true;
    }
    return false;
  }

  /**
   * Fetches additional items if needed.
   */
  handleScroll = () => {
    // Only fetch more items if we already have some items loaded.
    // The initial render should be supplied through props.
    if (!this.props.items.length || this.fetchingWith) {
      return;
    }

    // Only load items if props.loadItems is defined.
    if (!this.props.loadItems) {
      return;
    }

    const column = this.shortestColumn();
    const height = this.currColHeights[column];

    if (this.getScrollPos() + this.scrollBuffer > height) {
      this.fetchingWith = this.props.items.length;
      this.props.loadItems({
        from: this.props.items.length,
      });
    }
  }

  /**
   * # of columns * total item width - 1 item margin
   */
  determineWidth() {
    const eachItemWidth = this.props.columnWidth + this.props.gutterWidth;
    return `${(this.currColHeights.length * eachItemWidth) - this.props.gutterWidth}px`;
  }

  /**
   * Returns the index of the shortest column.
   */
  shortestColumn() {
    let min = 0;
    for (let i = 1; i < this.currColHeights.length; i += 1) {
      if (this.currColHeights[i] < this.currColHeights[min]) {
        min = i;
      }
    }
    return min;
  }

  /**
   * Processes height information for an item based on width and height.
   */
  processInfo = (element: HTMLElement, width: number, height: number) => {
    const column = this.shortestColumn();
    const top = this.currColHeights[column] || 0;
    const left = (column * this.props.columnWidth) + (this.props.gutterWidth * column);
    this.currColHeights[column] += height + this.props.gutterWidth;
    /* eslint no-param-reassign: 0 */
    element.style.top = `${top}px`;
    element.style.left = `${left}px`;
    element.className = styles.Grid__Item;
  }

  render() {
    if (this.fetchingWith !== false && this.fetchingWith !== this.props.items.length) {
      this.fetchingWith = false;
    }

    return (
      <div
        className={styles.Grid}
        ref={(ref) => { this.gridWrapper = ref; }}
      >
        <WithLayout
          data={this.props.items}
          invalidateCacheKey={this.cacheKey}
          layoutReady={this.state.layoutReady}
          processInfo={this.processInfo}
        >
          {this.props.items.map((item, idx) =>
            <div
              className="static"
              key={idx}
            >
              <this.props.comp data={this.props.items[idx]} itemIdx={idx} />
            </div>
          )}
        </WithLayout>
      </div>
    );
  }
}

ClassicGrid.propTypes = {
  /**
   * The width of each column.
   */
  columnWidth: React.PropTypes.number,

  /**
   * The component to render.
   */
  /* eslint react/no-unused-prop-types: 0 */
  comp: React.PropTypes.func,

  /**
   * The amount of space between each item.
   */
  gutterWidth: React.PropTypes.number,

  /**
   * An array of all objects to display in the grid.
   */
  items: React.PropTypes.arrayOf(React.PropTypes.shape({})),

  /**
   * A callback which the grid calls when we need to load more items as the user scrolls.
   * The callback should update the state of the items, and pass those in as props
   * to this component.
   */
  loadItems: React.PropTypes.func,

  /**
   * Minimum number of columns to display.
   */
  minCols: React.PropTypes.number,

  /**
   * The scroll container to use. Defaults to window.
   */
  scrollContainer: React.PropTypes.shape({
    addEventListener: React.PropTypes.func,
    removeEventListener: React.PropTypes.func,
  }),
};

ClassicGrid.defaultProps = {
  columnWidth: 236,
  gutterWidth: 14,
  minCols: 3,
  scrollContainer: typeof window !== 'undefined' ? window : null,
};