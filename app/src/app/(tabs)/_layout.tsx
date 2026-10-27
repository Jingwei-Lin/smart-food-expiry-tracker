import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, View } from 'react-native';

const BUTTON_COLOR = '#A6D45A';
const ACTIVE_COLOR = '#1E2A16';
const INACTIVE_COLOR = '#55614D';

const BAR_HEIGHT = 68;
const BUTTON_SIZE = 66;
const BUTTON_RISE = 18; // how far the middle button sticks up above the bar
const ICON_SIZE = 25;

/* The four tabs, left to right. `route` is the screen's file name in this folder. */
const TABS = [
  {
    route: 'index',
    label: 'Home',
    icon: (color: string) => <Ionicons color={color} name="home-outline" size={ICON_SIZE} />,
  },
  {
    route: 'summary',
    label: 'Summary',
    icon: (color: string) => <Ionicons color={color} name="stats-chart-outline" size={ICON_SIZE} />,
  },
  {
    route: 'donation-points',
    label: 'Donation points',
    icon: (color: string) => <Ionicons color={color} name="location-outline" size={ICON_SIZE} />,
  },
  {
    route: 'recipes',
    label: 'Recipes',
    icon: (color: string) => <Ionicons color={color} name="book-outline" size={ICON_SIZE} />,
  },
];

function TabBar({ state, emitter, navigateToTab, insets }: BottomTabBarProps) {
  const focusedKey = state.routes[state.index].key;

  function renderTab(tab: (typeof TABS)[number]) {
    const route = state.routes.find((candidate) => candidate.name === tab.route);

    if (!route) {
      return null;
    }

    const focused = route.key === focusedKey;

    return (
      <Pressable
        key={tab.route}
        accessibilityLabel={tab.label}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onPress={() => {
          const event = emitter.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        }}
        onLongPress={() => emitter.emit({ type: 'tabLongPress', target: route.key })}
        style={styles.tab}
      >
        {focused ? <View style={styles.indicator} /> : null}

        {tab.icon(focused ? ACTIVE_COLOR : INACTIVE_COLOR)}
      </Pressable>
    );
  }

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View
        style={[styles.bar, { height: BAR_HEIGHT + insets.bottom, paddingBottom: insets.bottom }]}
      >
        {TABS.slice(0, 2).map(renderTab)}

        {/* Empty space under the middle button. */}
        <View style={styles.tab} />

        {TABS.slice(2).map(renderTab)}
      </View>

      <View pointerEvents="box-none" style={styles.buttonSlot}>
        <Pressable
          accessibilityLabel="Scan a grocery item"
          accessibilityRole="button"
          onPress={() => router.push('/scan')}
          style={({ pressed }) => [styles.button, pressed ? styles.pressed : null]}
        >
          <Ionicons color={ACTIVE_COLOR} name="add" size={40} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * The tabs behind the bottom bar. The bar is drawn over the screens, and the
 * button in the middle of it is not a tab: it opens the scanner on top.
 *
 * The inventory is `index`, so the app still opens on it.
 */
export default function TabsLayout() {
  return (
    <Tabs
      backBehavior="initialRoute"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="summary" />
      <Tabs.Screen name="donation-points" />
      <Tabs.Screen name="recipes" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: BUTTON_RISE,
  },
  bar: {
    flexDirection: 'row',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: '#ffffff',
    shadowColor: '#0f1a12',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indicator: {
    position: 'absolute',
    top: 0,
    width: 44,
    height: 4,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: ACTIVE_COLOR,
  },
  buttonSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: 22,
    backgroundColor: BUTTON_COLOR,
    shadowColor: '#0f1a12',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 12,
  },
  pressed: {
    opacity: 0.8,
  },
});
