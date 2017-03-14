/* eslint-env jest */
import React from 'react';
import renderer from 'react-test-renderer';
import Image from '../Image';

test('Image matches snapshot', () => {
  const component = renderer.create(
    <Image alt="foo" naturalHeight={50} naturalWidth={50} src="foo.png" />
  );
  const tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});

test('Image with overlay matches snapshot', () => {
  const component = renderer.create(
    <Image alt="foo" naturalHeight={50} naturalWidth={50} src="foo.png">
      Foo.png
    </Image>
  );
  const tree = component.toJSON();
  expect(tree).toMatchSnapshot();
});
